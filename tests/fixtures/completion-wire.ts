/**
 * The parts of the OpenAI streaming wire contract that both stub servers speak.
 * Shared across the tiers so a change to the chunk envelope or the SSE framing
 * is one edit rather than two that can silently drift apart.
 */
export function chunk(
  delta: Record<string, string>,
  finishReason: string | null = null,
) {
  return JSON.stringify({
    id: 'stub',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
}

export function modelListBody(ids: readonly string[]) {
  return {
    object: 'list',
    data: ids.map((id) => ({ id, object: 'model', created: 0 })),
  };
}

export function sseStream(payloads: readonly string[], delayMs = 0) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= payloads.length) {
        controller.close();
        return;
      }

      if (delayMs > 0) {
        await Bun.sleep(delayMs);
      }

      controller.enqueue(encoder.encode(`data: ${payloads[index]}\n\n`));
      index += 1;
    },
  });
}
