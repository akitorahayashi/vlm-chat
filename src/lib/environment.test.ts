import { describe, expect, it } from 'bun:test';
import { getDatabaseUrl, getInferenceEndpoint } from './environment';

describe('database url', () => {
  it('needs no configuration', () => {
    expect(getDatabaseUrl({})).toBe('file:./data/dev.db');
  });

  it('accepts an override so tests can use a temporary file', () => {
    expect(getDatabaseUrl({ DATABASE_URL: 'file:/tmp/test.db' })).toBe(
      'file:/tmp/test.db',
    );
  });

  it('rejects an override that is not SQLite', () => {
    expect(() =>
      getDatabaseUrl({ DATABASE_URL: 'postgresql://localhost/chat' }),
    ).toThrow('DATABASE_URL must use file: or sqlite:.');
  });
});

describe('inference endpoint', () => {
  it('defaults to where mlx-vlm listens', () => {
    expect(getInferenceEndpoint({})).toBe('http://127.0.0.1:8080');
  });

  it('accepts a configured endpoint', () => {
    expect(
      getInferenceEndpoint({ VLM_CHAT_INFERENCE_URL: 'http://10.0.0.2:9000' }),
    ).toBe('http://10.0.0.2:9000');
  });

  it('strips trailing slashes so paths concatenate cleanly', () => {
    expect(
      getInferenceEndpoint({
        VLM_CHAT_INFERENCE_URL: 'http://127.0.0.1:8080//',
      }),
    ).toBe('http://127.0.0.1:8080');
  });

  it('rejects an endpoint that is not http', () => {
    expect(() =>
      getInferenceEndpoint({ VLM_CHAT_INFERENCE_URL: '127.0.0.1:8080' }),
    ).toThrow('VLM_CHAT_INFERENCE_URL must use http:// or https://.');
  });
});
