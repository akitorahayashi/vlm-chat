import { describe, expect, it } from 'bun:test';
import { startInferenceStub } from './fixtures/inference-stub';

async function get() {
  const { GET } = await import('@/app/api/models/route');

  return GET(new Request('http://localhost/api/models'));
}

describe('models route', () => {
  it('reports whatever the inference server has downloaded', async () => {
    const stub = startInferenceStub({
      models: ['mlx-community/A-4bit', 'mlx-community/B-3bit'],
    });

    process.env.VLM_CHAT_INFERENCE_URL = stub.url;

    try {
      const response = await get();

      expect(response.status).toBe(200);
      expect((await response.json()).models).toEqual([
        'mlx-community/A-4bit',
        'mlx-community/B-3bit',
      ]);
    } finally {
      stub.stop();
    }
  });

  it('answers 502 rather than an empty list when the server is down', async () => {
    const stub = startInferenceStub({});
    const url = stub.url;

    process.env.VLM_CHAT_INFERENCE_URL = url;
    stub.stop();

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.models).toBeUndefined();
    expect(body.error).toContain(url);
  });
});
