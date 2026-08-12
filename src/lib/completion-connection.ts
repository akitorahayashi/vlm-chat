import type { CompletionRequest } from '@/features/completion/parse';
import { type ChatEvent, decodeChatEvent } from './chat-event';
import { readServerSentEvents } from './server-sent-events';

async function describeRejection(response: Response) {
  const body: unknown = await response.json().catch(() => null);

  if (
    body !== null &&
    typeof body === 'object' &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error;
  }

  return `The chat request failed with status ${response.status}.`;
}

/**
 * `fetch` with a reader rather than `EventSource`: the request is a POST that
 * carries base64 images, which `EventSource` cannot send.
 */
export async function* openCompletionConnection(input: {
  request: CompletionRequest;
  signal: AbortSignal;
}): AsyncGenerator<ChatEvent> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.request),
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(await describeRejection(response));
  }

  if (!response.body) {
    throw new Error('The chat response had no body.');
  }

  for await (const payload of readServerSentEvents(response.body)) {
    yield decodeChatEvent(payload);
  }
}
