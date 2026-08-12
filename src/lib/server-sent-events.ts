/**
 * The `text/event-stream` wire format, read and written. Both directions are
 * needed: the server parses what mlx-vlm sends, and the browser parses what
 * this app's own route handler sends.
 */

export async function* readServerSentEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];

  function consume(line: string): string | null {
    if (line === '') {
      if (dataLines.length === 0) {
        return null;
      }

      const payload = dataLines.join('\n');
      dataLines = [];
      return payload;
    }

    if (line.startsWith(':')) {
      return null;
    }

    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);

    if (field !== 'data') {
      return null;
    }

    const value = separator === -1 ? '' : line.slice(separator + 1);
    dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
    return null;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      for (;;) {
        const newline = buffer.indexOf('\n');

        if (newline === -1) {
          break;
        }

        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);

        const payload = consume(line);

        if (payload !== null) {
          yield payload;
        }
      }
    }

    buffer += decoder.decode();

    if (buffer !== '') {
      consume(buffer.replace(/\r$/, ''));
    }

    // A producer that closes without a terminating blank line still meant to
    // send the event it had accumulated.
    const trailing = consume('');

    if (trailing !== null) {
      yield trailing;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Payloads must not contain newlines or the framing breaks. Every caller passes
 * `JSON.stringify` output, which escapes them.
 */
export function createServerSentEventStream(
  payloads: AsyncIterable<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = payloads[Symbol.asyncIterator]();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await iterator.next();

      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(`data: ${value}\n\n`));
    },
    // Runs the generator's `finally`, which is how a disconnected browser ends
    // up recording an interrupted turn.
    async cancel(reason) {
      await iterator.return?.(reason);
    },
  });
}
