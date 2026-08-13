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
import { describeError } from '@/lib/describe-error';
import { getInferenceEndpoint } from '@/lib/environment';
import { openChatCompletion } from '@/lib/inference/client';
import { buildChatCompletionRequest, drawSeed } from '@/lib/inference/request';
import { claimCompletion, releaseCompletion } from '@/lib/running-completions';
import { createServerSentEventStream } from '@/lib/server-sent-events';

export const dynamic = 'force-dynamic';

/**
 * A rejection names the conversation whenever one exists, including the one
 * this request just created. The user's message is already stored in it, so a
 * caller that does not learn the id would start a second conversation on the
 * next attempt and strand the first.
 */
function reject(message: string, status: number, conversationId?: string) {
  return Response.json({ error: message, conversationId }, { status });
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
    generation: parsed.generation,
  });

  if (!conversation) {
    return reject(`No conversation with id ${parsed.conversationId}.`, 404);
  }

  const generation = new AbortController();

  // Kept as a second trigger rather than the only one: it does fire in some
  // runtimes, and costs nothing where it does not.
  request.signal.addEventListener('abort', () => generation.abort());

  // Claimed before the user turn is written. A second request would otherwise
  // append its message and then build a prompt from a history that excludes the
  // reply still being streamed into the first one.
  if (
    !claimCompletion({
      completionId: parsed.completionId,
      conversationId: conversation.id,
      controller: generation,
    })
  ) {
    return reject(
      'This conversation is already generating a reply. Wait for it to finish, or stop it first.',
      409,
      conversation.id,
    );
  }

  let handedOff = false;

  try {
    // Written before the upstream call: what the user typed and attached is a
    // fact regardless of whether the model ever answers, and a retry should not
    // require typing it again.
    const userMessage = await appendUserMessage({
      conversationId: conversation.id,
      modelId: parsed.modelId,
      generation: parsed.generation,
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
      generation: parsed.generation,
    });

    const endpoint = getInferenceEndpoint();
    let upstream: ReadableStream<Uint8Array>;

    try {
      upstream = await openChatCompletion(body, generation.signal);
    } catch (error) {
      if (isAbortError(error)) {
        // Stopped while the model was still being read off disk. Nothing was
        // generated, so there is no assistant turn to record.
        return new Response(null, { status: 499 });
      }

      return reject(describeError(error), 502, conversation.id);
    }

    // Only after the upstream commits: a refused connection or a 4xx must not
    // leave a turn stranded in 'streaming'.
    let assistantMessage: { id: string };

    try {
      assistantMessage = await startAssistantMessage({
        conversationId: conversation.id,
        modelId: parsed.modelId,
        seed,
        generation: parsed.generation,
      });
    } catch (error) {
      // The server is already generating and nothing downstream will ever read
      // it, so it has to be told to stop here: no assistant turn exists to
      // carry the tokens, and the model would stay busy to the end.
      generation.abort();

      // Closes the body on a runtime where aborting a settled fetch does not.
      // It rejects when the abort above already errored the stream, which is
      // the expected case and says nothing a caller could act on.
      void upstream.cancel().catch(() => {});

      throw error;
    }

    handedOff = true;

    return new Response(
      createServerSentEventStream(
        encodeChatEvents(
          runCompletion({
            completionId: parsed.completionId,
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
  } finally {
    // Only a stream that was actually handed to the client keeps the claim;
    // `runCompletion` releases that one. Anything else — an early return, a
    // failed write — must not leave the conversation locked.
    if (!handedOff) {
      releaseCompletion(parsed.completionId);
    }
  }
}
