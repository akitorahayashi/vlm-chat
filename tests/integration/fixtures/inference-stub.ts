import { modelListBody, sseStream } from '../../fixtures/completion-wire';

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
function startInferenceStub(script: InferenceStubScript = {}) {
  const received: unknown[] = [];

  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      const { pathname } = new URL(request.url);

      if (pathname === '/v1/models') {
        return Response.json(modelListBody(script.models ?? ['stub/model']));
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

        return new Response(
          sseStream(script.chunks ?? [], script.delayMs ?? 0),
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

/**
 * The same stub, with the application pointed at it for the handle's lifetime.
 * `bun test` runs every file in one process, so an endpoint left behind is the
 * one whatever file runs next would read.
 */
export function useInferenceStub(script: InferenceStubScript = {}) {
  const stub = startInferenceStub(script);
  const previous = process.env.VLM_CHAT_INFERENCE_URL;

  process.env.VLM_CHAT_INFERENCE_URL = stub.url;

  return {
    url: stub.url,
    received: stub.received,
    /**
     * Stops the server while the application stays pointed at its port, which
     * is how a test reaches an endpoint with nothing listening.
     */
    stopServer: stub.stop,
    stop: () => {
      stub.stop();

      if (previous === undefined) {
        delete process.env.VLM_CHAT_INFERENCE_URL;
      } else {
        process.env.VLM_CHAT_INFERENCE_URL = previous;
      }
    },
  };
}
