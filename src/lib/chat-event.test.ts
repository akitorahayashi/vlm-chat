import { describe, expect, it } from 'bun:test';
import { type ChatEvent, decodeChatEvent, encodeChatEvent } from './chat-event';

describe('chat events', () => {
  it('round-trips every event kind', () => {
    const events: ChatEvent[] = [
      {
        type: 'start',
        conversationId: 'c1',
        userMessageId: 'm1',
        assistantMessageId: 'm2',
        modelId: 'a/b',
      },
      { type: 'delta', content: 'hi' },
      { type: 'delta', reasoning: 'thinking' },
      { type: 'end', finishReason: 'stop' },
      { type: 'end', finishReason: null },
      { type: 'error', message: 'upstream said no' },
    ];

    for (const event of events) {
      expect(decodeChatEvent(encodeChatEvent(event))).toEqual(event);
    }
  });

  it('rejects an unknown event type', () => {
    expect(() => decodeChatEvent('{"type":"progress"}')).toThrow(
      'Received an unrecognized chat event',
    );
  });

  it('rejects a payload that is not JSON', () => {
    expect(() => decodeChatEvent('not json')).toThrow(
      'Received a chat event that is not JSON',
    );
  });
});
