import { readCompletionHistory } from '@/features/completion/history';
import { buildCompletionMessages } from '@/features/completion/messages';
import {
  type CompletionRequest,
  CompletionRequestError,
  parseCompletionRequest,
} from '@/features/completion/parse';
import { runCompletion } from '@/features/completion/run';
import { resolveConversation } from '@/features/conversation/resolve';
import { deriveConversationTitle } from '@/features/conversation/title';
import { appendUserMessage } from '@/features/message/append';
import { startAssistantMessage } from '@/features/message/start';
import { isAbortError } from '@/lib/abort-error';
import { encodeChatEvents } from '@/lib/chat-event';
import { getInferenceEndpoint } from '@/lib/environment';
import { openChatCompletion } from '@/lib/inference/client';
import { buildChatCompletionRequest, drawSeed } from '@/lib/inference/request';
import { registerCompletion } from '@/lib/running-completions';
import { createServerSentEventStream } from '@/lib/server-sent-events';

export const dynamic = 'force-dynamic';

function reject(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let parsed: CompletionRequest;

  try {
    parsed = parseCompletionRequest(await request.json());
  } catch (error) {
    if (error instanceof CompletionRequestError) {
      return reject(error.message, 400);
    }

    return reject('The request body is not valid JSON.', 400);
  }

  const conversation = await resolveConversation({
    conversationId: parsed.conversationId,
    modelId: parsed.modelId,
    title: deriveConversationTitle(parsed.text, parsed.attachments.length),
  });

  if (!conversation) {
    return reject(`No conversation with id ${parsed.conversationId}.`, 404);
  }

  // Written before the upstream call: what the user typed and attached is a
  // fact regardless of whether the model ever answers, and a retry should not
  // require typing it again.
  const userMessage = await appendUserMessage({
    conversationId: conversation.id,
    modelId: parsed.modelId,
    text: parsed.text,
    attachments: parsed.attachments,
  });

  const seed = drawSeed();
  const body = buildChatCompletionRequest({
    modelId: parsed.modelId,
    messages: buildCompletionMessages(
      await readCompletionHistory(conversation.id),
    ),
    seed,
  });

  const endpoint = getInferenceEndpoint();
  const generation = new AbortController();

  // Kept as a second trigger rather than the only one: it does fire in some
  // runtimes, and costs nothing where it does not.
  request.signal.addEventListener('abort', () => generation.abort());

  let upstream: ReadableStream<Uint8Array>;

  try {
    upstream = await openChatCompletion(body, generation.signal);
  } catch (error) {
    if (isAbortError(error)) {
      // The browser went away before generation began; nobody is left to read
      // a body, and no assistant turn was ever started.
      return new Response(null, { status: 499 });
    }

    return reject(error instanceof Error ? error.message : String(error), 502);
  }

  // Only after the upstream commits: a refused connection or a 4xx must not
  // leave a turn stranded in 'streaming'.
  const assistantMessage = await startAssistantMessage({
    conversationId: conversation.id,
    modelId: parsed.modelId,
    seed,
  });

  registerCompletion(assistantMessage.id, generation);

  return new Response(
    createServerSentEventStream(
      encodeChatEvents(
        runCompletion({
          conversationId: conversation.id,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          modelId: parsed.modelId,
          endpoint,
          body: upstream,
        }),
      ),
    ),
    {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    },
  );
}
