import { describe, expect, it } from 'bun:test';
import {
  createServerSentEventStream,
  readServerSentEvents,
} from './server-sent-events';

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const payloads: string[] = [];

  for await (const payload of readServerSentEvents(stream)) {
    payloads.push(payload);
  }

  return payloads;
}

describe('reading server-sent events', () => {
  it('separates events on blank lines', async () => {
    expect(await collect(streamOf('data: one\n\ndata: two\n\n'))).toEqual([
      'one',
      'two',
    ]);
  });

  it('reassembles a payload split across chunk boundaries', async () => {
    expect(await collect(streamOf('data: {"a":', '1}\n', '\n'))).toEqual([
      '{"a":1}',
    ]);
  });

  it('accepts CRLF line endings', async () => {
    expect(await collect(streamOf('data: one\r\n\r\n'))).toEqual(['one']);
  });

  it('ignores comment lines and fields other than data', async () => {
    expect(
      await collect(streamOf(': keep-alive\nevent: message\ndata: one\n\n')),
    ).toEqual(['one']);
  });

  it('joins a multi-line payload with newlines', async () => {
    expect(await collect(streamOf('data: one\ndata: two\n\n'))).toEqual([
      'one\ntwo',
    ]);
  });

  it('preserves a value that has no leading space', async () => {
    expect(await collect(streamOf('data:one\n\n'))).toEqual(['one']);
  });

  it('emits an event that never received its blank line', async () => {
    expect(await collect(streamOf('data: one'))).toEqual(['one']);
  });

  it('emits nothing for an empty stream', async () => {
    expect(await collect(streamOf())).toEqual([]);
  });
});

describe('writing server-sent events', () => {
  it('round-trips payloads through the wire format', async () => {
    async function* payloads() {
      yield '{"type":"delta"}';
      yield '[DONE]';
    }

    expect(await collect(createServerSentEventStream(payloads()))).toEqual([
      '{"type":"delta"}',
      '[DONE]',
    ]);
  });

  it('ends the source generator when the reader cancels', async () => {
    let ended = false;

    async function* payloads() {
      try {
        yield 'one';
        yield 'two';
      } finally {
        ended = true;
      }
    }

    const stream = createServerSentEventStream(payloads());
    const reader = stream.getReader();

    await reader.read();
    await reader.cancel();

    expect(ended).toBe(true);
  });
});
