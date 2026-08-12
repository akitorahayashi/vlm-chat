import { readServerSentEvents } from '../server-sent-events';
import {
  completionChunkSchema,
  describeStreamError,
  streamErrorSchema,
} from './schema';

export type CompletionEvent =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'finish'; reason: string }
  | { type: 'error'; message: string };

/**
 * Anything that is not a well-formed chunk becomes an `error` event. Skipping
 * an unreadable payload would turn a broken response into a short one.
 */
export async function* decodeCompletionStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<CompletionEvent> {
  let terminated = false;

  for await (const payload of readServerSentEvents(body)) {
    if (payload === '[DONE]') {
      terminated = true;
      break;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(payload);
    } catch {
      yield {
        type: 'error',
        message: `The inference server sent a payload that is not JSON: ${payload}`,
      };
      return;
    }

    // The server commits HTTP 200 before generating, so a failure part-way
    // through arrives as a payload rather than a status code.
    const failure = streamErrorSchema.safeParse(parsed);

    if (failure.success) {
      yield { type: 'error', message: describeStreamError(failure.data) };
      return;
    }

    const chunk = completionChunkSchema.safeParse(parsed);

    if (!chunk.success) {
      yield {
        type: 'error',
        message: `The inference server sent an unrecognized chunk: ${payload}`,
      };
      return;
    }

    for (const choice of chunk.data.choices) {
      const delta = choice.delta;

      // The server mirrors `reasoning` onto `reasoning_content`, so taking both
      // would double every reasoning token.
      const reasoning = delta?.reasoning_content ?? delta?.reasoning;

      if (reasoning) {
        yield { type: 'reasoning', text: reasoning };
      }

      if (delta?.content) {
        yield { type: 'content', text: delta.content };
      }

      if (choice.finish_reason) {
        yield { type: 'finish', reason: choice.finish_reason };
      }
    }
  }

  if (!terminated) {
    yield {
      type: 'error',
      message: 'The inference stream ended before the response was complete.',
    };
  }
}
