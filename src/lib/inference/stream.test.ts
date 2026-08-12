import { describe, expect, it } from 'bun:test';
import { type CompletionEvent, decodeCompletionStream } from './stream';

function upstream(...events: string[]) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }

      controller.close();
    },
  });
}

function chunk(delta: Record<string, string>, finishReason?: string) {
  return JSON.stringify({
    choices: [{ index: 0, delta, finish_reason: finishReason ?? null }],
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events: CompletionEvent[] = [];

  for await (const event of decodeCompletionStream(stream)) {
    events.push(event);
  }

  return events;
}

describe('decoding a completion stream', () => {
  it('yields content deltas', async () => {
    expect(
      await collect(
        upstream(chunk({ content: 'he' }), chunk({ content: 'llo' }), '[DONE]'),
      ),
    ).toEqual([
      { type: 'content', text: 'he' },
      { type: 'content', text: 'llo' },
    ]);
  });

  it('keeps reasoning on its own channel', async () => {
    expect(
      await collect(
        upstream(
          chunk({ reasoning_content: 'weighing' }),
          chunk({ content: 'answer' }),
          '[DONE]',
        ),
      ),
    ).toEqual([
      { type: 'reasoning', text: 'weighing' },
      { type: 'content', text: 'answer' },
    ]);
  });

  it('counts a mirrored reasoning field once', async () => {
    expect(
      await collect(
        upstream(
          chunk({ reasoning: 'once', reasoning_content: 'once' }),
          '[DONE]',
        ),
      ),
    ).toEqual([{ type: 'reasoning', text: 'once' }]);
  });

  it('reports the finish reason', async () => {
    expect(
      await collect(upstream(chunk({ content: 'x' }, 'stop'), '[DONE]')),
    ).toEqual([
      { type: 'content', text: 'x' },
      { type: 'finish', reason: 'stop' },
    ]);
  });

  it('surfaces an error payload sent after the status was committed', async () => {
    expect(
      await collect(
        upstream(chunk({ content: 'partial' }), '{"error":"out of memory"}'),
      ),
    ).toEqual([
      { type: 'content', text: 'partial' },
      { type: 'error', message: 'out of memory' },
    ]);
  });

  it('surfaces a structured error payload', async () => {
    expect(
      await collect(upstream('{"error":{"message":"bad model"}}')),
    ).toEqual([{ type: 'error', message: 'bad model' }]);
  });

  it('treats an unparsable payload as an error rather than skipping it', async () => {
    const events = await collect(upstream('{oops', '[DONE]'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });

  it('treats an unrecognized chunk shape as an error', async () => {
    const events = await collect(upstream('{"choices":"nope"}', '[DONE]'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });

  it('treats a payload with no choices as an error rather than an empty chunk', async () => {
    const events = await collect(upstream('{"id":"abc"}', '[DONE]'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });

  it('reports a stream that ended before [DONE]', async () => {
    expect(await collect(upstream(chunk({ content: 'cut' })))).toEqual([
      { type: 'content', text: 'cut' },
      {
        type: 'error',
        message: 'The inference stream ended before the response was complete.',
      },
    ]);
  });
});
