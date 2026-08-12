export type InferenceStubScript = {
  models?: string[];
  chunks?: string[];
  delayMs?: number;
  /** Time before the response headers arrive, standing in for a model load. */
  headerDelayMs?: number;
  chatStatus?: number;
  chatBody?: string;
};

/**
 * Stands in for `mlx_vlm.server`. It encodes the parts of the OpenAI wire
 * contract this app depends on, so the route handler can be exercised on a
 * machine that cannot run MLX at all.
 */
export function startInferenceStub(script: InferenceStubScript = {}) {
  const encoder = new TextEncoder();
  const received: unknown[] = [];

  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      const { pathname } = new URL(request.url);

      if (pathname === '/v1/models') {
        return Response.json({
          object: 'list',
          data: (script.models ?? ['stub/model']).map((id) => ({
            id,
            object: 'model',
            created: 0,
          })),
        });
      }

      if (pathname === '/v1/chat/completions') {
        received.push(await request.json());

        if (script.headerDelayMs) {
          await Bun.sleep(script.headerDelayMs);
        }

        if (script.chatStatus && script.chatStatus !== 200) {
          return new Response(script.chatBody ?? 'stub failure', {
            status: script.chatStatus,
          });
        }

        const payloads = script.chunks ?? [];
        let index = 0;

        return new Response(
          new ReadableStream<Uint8Array>({
            async pull(controller) {
              if (index >= payloads.length) {
                controller.close();
                return;
              }

              if (script.delayMs) {
                await Bun.sleep(script.delayMs);
              }

              controller.enqueue(
                encoder.encode(`data: ${payloads[index]}\n\n`),
              );
              index += 1;
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      }

      return new Response('not found', { status: 404 });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}`,
    received,
    stop: () => server.stop(true),
  };
}
