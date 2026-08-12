import { STUB_INFERENCE_PORT } from '../ports.ts';

/**
 * Stands in for `mlx_vlm.server` so the browser tests can run anywhere,
 * including the Linux runners in CI where MLX cannot exist.
 *
 * The ids are deliberately not the real Qwen3-VL ones: the picker is supposed
 * to show whatever the server reports, and inventing names here is what proves
 * the app holds no model list of its own.
 */
const BEHAVIOURS = {
  'stub/echo': [
    chunk({ content: 'Hello from ' }),
    chunk({ content: 'the stub.' }),
    chunk({}, 'stop'),
    '[DONE]',
  ],
  'stub/reasoning': [
    chunk({ reasoning_content: 'The sky scatters short wavelengths.' }),
    chunk({ content: 'Blue.' }),
    chunk({}, 'stop'),
    '[DONE]',
  ],
  'stub/error': [
    chunk({ content: 'Partial answer' }),
    '{"error":"the stub ran out of memory"}',
  ],
  'stub/slow': [
    chunk({ content: 'one ' }),
    chunk({ content: 'two ' }),
    chunk({ content: 'three ' }),
    chunk({ content: 'four ' }),
    chunk({ content: 'five' }),
    chunk({}, 'stop'),
    '[DONE]',
  ],
  'stub/refuse': [],
} as const;

const SLOW_DELAY_MS = 400;

function chunk(
  delta: Record<string, string>,
  finishReason: string | null = null,
) {
  return JSON.stringify({
    id: 'stub',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
}

function streamOf(payloads: readonly string[], delayMs: number) {
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

Bun.serve({
  port: STUB_INFERENCE_PORT,
  hostname: '127.0.0.1',
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === '/health') {
      return Response.json({ status: 'healthy', loaded_model: null });
    }

    if (pathname === '/v1/models') {
      return Response.json({
        object: 'list',
        data: Object.keys(BEHAVIOURS).map((id) => ({
          id,
          object: 'model',
          created: 0,
        })),
      });
    }

    if (pathname === '/v1/chat/completions') {
      const body = (await request.json()) as { model?: string };
      const model = body.model ?? '';

      if (model === 'stub/refuse') {
        return new Response('the stub refuses this model', { status: 500 });
      }

      const payloads = BEHAVIOURS[model as keyof typeof BEHAVIOURS];

      if (!payloads) {
        return new Response(`unknown stub model ${model}`, { status: 404 });
      }

      return new Response(
        streamOf(payloads, model === 'stub/slow' ? SLOW_DELAY_MS : 0),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    return new Response('not found', { status: 404 });
  },
});

console.log(
  `inference stub listening on http://127.0.0.1:${STUB_INFERENCE_PORT}`,
);
