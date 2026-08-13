'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MAX_ATTACHMENTS } from '@/features/completion/parse';
import type { TranscriptMessage } from '@/features/conversation/read';
import {
  CompletionRejected,
  openCompletionConnection,
} from '@/lib/completion-connection';
import { describeError } from '@/lib/describe-error';
import { type DraftImage, downscaleImage } from '@/lib/image-downscale';
import { Composer } from './composer';
import { ErrorBanner } from './error-banner';
import { ModelPicker } from './model-picker';
import { Transcript } from './transcript';
import type { TurnView } from './turn';

const PENDING_USER_ID = 'pending-user';
const PENDING_ASSISTANT_ID = 'pending-assistant';

const SWITCH_NOTICE =
  'The inference server keeps one model loaded, so the next reply starts only after this one has been read from disk.';

function toTurn(message: TranscriptMessage): TurnView {
  return {
    id: message.id,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    reasoning: message.reasoning ?? '',
    status: message.status,
    errorMessage: message.errorMessage,
    modelId: message.modelId,
    images: message.attachments.map((attachment) => ({
      id: attachment.id,
      source: `/api/attachments/${attachment.id}`,
    })),
  };
}

export function ChatView({
  conversationId,
  messages,
  modelId,
}: {
  conversationId: string | null;
  messages: TranscriptMessage[];
  modelId: string | null;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<TurnView[]>(() => messages.map(toTurn));
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<DraftImage[]>([]);
  const [models, setModels] = useState<string[] | null>(null);
  const [selectedModel, setSelectedModel] = useState(modelId);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const completion = useRef<string | null>(null);

  // Fetched from the browser rather than during server rendering: a server-side
  // fetch would make the whole page fail when the Python side is down, and
  // would tie `next build` and the system tests to a live inference server.
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch('/api/models', {
          signal: controller.signal,
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? `Status ${response.status}.`);
        }

        setModels(body.models);
        setSelectedModel((current) => current ?? body.models[0] ?? null);
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }

        setModels([]);
        setError(describeError(cause));
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  // Navigating away leaves the reader with nowhere to put what it reads. The
  // server is not told: `stop()` is what cancels a turn, and a reply the user
  // navigated away from is still worth recording.
  useEffect(() => () => abort.current?.abort(), []);

  function updateTurn(id: string, next: (turn: TurnView) => Partial<TurnView>) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === id ? { ...turn, ...next(turn) } : turn,
      ),
    );
  }

  function patch(id: string, next: Partial<TurnView>) {
    updateTurn(id, () => next);
  }

  function appendDelta(id: string, content?: string, reasoning?: string) {
    updateTurn(id, (turn) => ({
      content: turn.content + (content ?? ''),
      reasoning: turn.reasoning + (reasoning ?? ''),
    }));
  }

  async function addFiles(files: File[]) {
    const room = MAX_ATTACHMENTS - images.length;

    if (room <= 0) {
      setError(`A message carries at most ${MAX_ATTACHMENTS} images.`);
      return;
    }

    // Settled rather than all: one file the browser cannot decode — a PDF
    // dropped along with photos — must not discard the ones next to it.
    const results = await Promise.allSettled(
      files.slice(0, room).map(downscaleImage),
    );
    const added = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const rejection = results.find((result) => result.status === 'rejected');

    if (added.length > 0) {
      // Clamped against the state at the time of the update rather than the
      // room measured above: two drops can be in flight at once.
      setImages((current) => [...current, ...added].slice(0, MAX_ATTACHMENTS));
    }

    if (rejection) {
      setError(describeError(rejection.reason));
    }
  }

  // Aborting the fetch only ends this page's reading. The server is told
  // separately, because that is what stops the model — and it is told by the id
  // this client chose, so stopping works during the long wait before the first
  // event, which is exactly when a model is being read off disk.
  async function stop() {
    const completionId = completion.current;

    abort.current?.abort();

    if (completionId === null) {
      return;
    }

    try {
      await fetch(`/api/completions/${completionId}`, { method: 'DELETE' });
    } catch (cause) {
      setError(
        `The turn was stopped here but may still be running: ${describeError(cause)}`,
      );
    }
  }

  async function send() {
    const text = draft.trim();

    if (!selectedModel || streamingId !== null) {
      return;
    }

    const attachments = images.map(({ mimeType, dataBase64 }) => ({
      mimeType,
      dataBase64,
    }));
    const previews = images.map((image) => ({
      id: image.id,
      source: image.dataUrl,
    }));

    setError(null);
    setDraft('');
    setImages([]);
    setTurns((current) => [
      ...current,
      {
        id: PENDING_USER_ID,
        role: 'user',
        content: text,
        reasoning: '',
        status: 'complete',
        errorMessage: null,
        modelId: null,
        images: previews,
      },
      {
        id: PENDING_ASSISTANT_ID,
        role: 'assistant',
        content: '',
        reasoning: '',
        status: 'streaming',
        errorMessage: null,
        modelId: selectedModel,
        images: [],
      },
    ]);
    setStreamingId(PENDING_ASSISTANT_ID);

    const controller = new AbortController();
    abort.current = controller;

    const completionId = crypto.randomUUID();
    completion.current = completionId;

    let assistantId = PENDING_ASSISTANT_ID;
    let startedConversationId: string | null = null;

    try {
      for await (const event of openCompletionConnection({
        request: {
          completionId,
          conversationId: conversationId ?? undefined,
          modelId: selectedModel,
          text,
          attachments,
        },
        signal: controller.signal,
      })) {
        if (event.type === 'start') {
          assistantId = event.assistantMessageId;
          startedConversationId = event.conversationId;
          setStreamingId(assistantId);
          setTurns((current) =>
            current.map((turn) => {
              if (turn.id === PENDING_USER_ID) {
                return { ...turn, id: event.userMessageId };
              }

              if (turn.id === PENDING_ASSISTANT_ID) {
                return { ...turn, id: event.assistantMessageId };
              }

              return turn;
            }),
          );
        } else if (event.type === 'delta') {
          appendDelta(assistantId, event.content, event.reasoning);
        } else if (event.type === 'end') {
          patch(assistantId, { status: 'complete' });
        } else {
          patch(assistantId, { status: 'failed', errorMessage: event.message });
          setError(event.message);
        }
      }
    } catch (cause) {
      if (controller.signal.aborted) {
        patch(assistantId, { status: 'aborted' });
      } else {
        // A rejection still names the conversation the message was stored in,
        // so the navigation below moves onto it and a retry continues that one
        // instead of opening another.
        if (cause instanceof CompletionRejected && cause.conversationId) {
          startedConversationId = cause.conversationId;
        }

        const message = describeError(cause);

        patch(assistantId, { status: 'failed', errorMessage: message });
        setError(message);
      }
    } finally {
      abort.current = null;
      completion.current = null;
      setStreamingId(null);
    }

    // Navigating mid-stream would remount this component and drop the reader.
    if (conversationId === null && startedConversationId !== null) {
      router.replace(`/conversations/${startedConversationId}`);
    } else {
      router.refresh();
    }
  }

  const canSend =
    selectedModel !== null &&
    streamingId === null &&
    (draft.trim().length > 0 || images.length > 0);

  // min-w-0 on the section is load-bearing: a flex child defaults to
  // min-width:auto, so without it this column keeps its content width on a
  // narrow screen and the composer spills over the send button.
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-1 dark:border-zinc-800">
        <ModelPicker
          models={models}
          value={selectedModel}
          disabled={streamingId !== null}
          onChange={(next) => {
            if (next !== selectedModel && turns.length > 0) {
              setNotice(SWITCH_NOTICE);
            }

            setSelectedModel(next);
          }}
        />
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-1">
        {notice ? (
          <p className="mt-3 border border-zinc-300 px-3 py-2 font-mono text-xs text-zinc-500 dark:border-zinc-700">
            {notice}
          </p>
        ) : null}

        {error ? (
          <div className="mt-3">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        ) : null}

        <Transcript turns={turns} streamingId={streamingId} />
      </div>

      <Composer
        draft={draft}
        images={images}
        streaming={streamingId !== null}
        canSend={canSend}
        onDraftChange={setDraft}
        onFiles={(files) => void addFiles(files)}
        onRemoveImage={(index) =>
          setImages((current) =>
            current.filter((_, position) => position !== index),
          )
        }
        onSubmit={() => void send()}
        onStop={() => void stop()}
      />
    </section>
  );
}
