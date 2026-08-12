import type { CompletionRequest } from '@/features/completion/parse';
import { type ChatEvent, decodeChatEvent } from './chat-event';
import { readServerSentEvents } from './server-sent-events';

/**
 * Carries the conversation the request belonged to, which for a first message
 * is one the server has just created and stored the user's turn in. Without it
 * the browser would still be on no conversation at all and a retry would open a
 * second one.
 */
export class CompletionRejected extends Error {
  constructor(
    message: string,
    readonly conversationId?: string,
  ) {
    super(message);
    this.name = 'CompletionRejected';
  }
}

async function describeRejection(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const fields =
    body !== null && typeof body === 'object'
      ? (body as { error?: unknown; conversationId?: unknown })
      : {};

  return new CompletionRejected(
    typeof fields.error === 'string'
      ? fields.error
      : `The chat request failed with status ${response.status}.`,
    typeof fields.conversationId === 'string'
      ? fields.conversationId
      : undefined,
  );
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
    throw await describeRejection(response);
  }

  if (!response.body) {
    throw new Error('The chat response had no body.');
  }

  for await (const payload of readServerSentEvents(response.body)) {
    yield decodeChatEvent(payload);
  }
}
