import { closeAssistantMessage } from '@/features/message/close';
import { isAbortError } from '@/lib/abort-error';
import type { ChatEvent } from '@/lib/chat-event';
import { describeInferenceFailure } from '@/lib/inference/failure';
import { decodeCompletionStream } from '@/lib/inference/stream';
import { releaseCompletion } from '@/lib/running-completions';

/**
 * Consumes the upstream stream, relays it as this app's own events, and writes
 * the assistant turn's terminal state exactly once on every path out —
 * including the one taken when the browser disconnects and the response stream
 * is cancelled, which resumes this generator at its `finally`.
 */
export async function* runCompletion(input: {
  completionId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  modelId: string;
  endpoint: string;
  body: ReadableStream<Uint8Array>;
}): AsyncGenerator<ChatEvent> {
  let content = '';
  let reasoning = '';
  let finishReason: string | null = null;
  let settled = false;

  const close = (
    status: 'complete' | 'aborted' | 'failed',
    errorMessage?: string,
  ) =>
    closeAssistantMessage({
      messageId: input.assistantMessageId,
      content,
      reasoning,
      status,
      finishReason,
      errorMessage,
    });

  yield {
    type: 'start',
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    assistantMessageId: input.assistantMessageId,
    modelId: input.modelId,
  };

  try {
    for await (const event of decodeCompletionStream(input.body)) {
      if (event.type === 'content') {
        content += event.text;
        yield { type: 'delta', content: event.text };
        continue;
      }

      if (event.type === 'reasoning') {
        reasoning += event.text;
        yield { type: 'delta', reasoning: event.text };
        continue;
      }

      if (event.type === 'finish') {
        finishReason = event.reason;
        continue;
      }

      settled = true;
      await close('failed', event.message);
      yield { type: 'error', message: event.message };
      return;
    }

    settled = true;
    await close('complete');
    yield { type: 'end', finishReason };
  } catch (error) {
    settled = true;

    if (isAbortError(error)) {
      await close('aborted');
      return;
    }

    const message = describeInferenceFailure(error, input.endpoint);
    await close('failed', message);
    yield { type: 'error', message };
  } finally {
    if (!settled) {
      await close('aborted');
    }

    releaseCompletion(input.completionId);
  }
}
