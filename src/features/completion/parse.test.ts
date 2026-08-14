import { describe, expect, it } from 'bun:test';
import { DEFAULT_GENERATION_SETTINGS } from './generation-settings';
import { parseCompletionRequest } from './parse';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

function request(overrides: Record<string, unknown> = {}) {
  return {
    completionId: 'c1',
    modelId: 'a/b',
    generation: DEFAULT_GENERATION_SETTINGS,
    text: 'hello',
    ...overrides,
  };
}

describe('parsing a completion request', () => {
  it('accepts text with no images', () => {
    expect(parseCompletionRequest(request())).toEqual({
      completionId: 'c1',
      modelId: 'a/b',
      generation: DEFAULT_GENERATION_SETTINGS,
      text: 'hello',
      attachments: [],
    });
  });

  it('requires a completion id, which is what a stop request names', () => {
    expect(() =>
      parseCompletionRequest(request({ completionId: '' })),
    ).toThrow();
  });

  it('trims the text', () => {
    expect(parseCompletionRequest(request({ text: '  hi  ' })).text).toBe('hi');
  });

  it('requires a model', () => {
    expect(() => parseCompletionRequest(request({ modelId: '' }))).toThrow(
      'modelId is required.',
    );
  });

  it('requires generation settings', () => {
    expect(() =>
      parseCompletionRequest(request({ generation: undefined })),
    ).toThrow();
  });

  it('requires text or an image', () => {
    expect(() => parseCompletionRequest(request({ text: '   ' }))).toThrow(
      'Send some text or at least one image.',
    );
  });

  it('accepts an image with no text', () => {
    const parsed = parseCompletionRequest(
      request({
        text: '',
        attachments: [{ mimeType: 'image/png', dataBase64: png }],
      }),
    );

    expect(parsed.attachments).toHaveLength(1);
  });

  it('rejects a mime type the app does not send', () => {
    expect(() =>
      parseCompletionRequest(
        request({ attachments: [{ mimeType: 'image/gif', dataBase64: png }] }),
      ),
    ).toThrow('An image must be one of');
  });

  it('rejects data that is not base64', () => {
    expect(() =>
      parseCompletionRequest(
        request({
          attachments: [{ mimeType: 'image/png', dataBase64: 'not base64!' }],
        }),
      ),
    ).toThrow('An image must be base64 encoded.');
  });

  it('rejects base64 that was cut mid-group', () => {
    expect(() =>
      parseCompletionRequest(
        request({
          attachments: [
            { mimeType: 'image/png', dataBase64: png.slice(0, -1) },
          ],
        }),
      ),
    ).toThrow('An image must be base64 encoded.');
  });

  it('rejects an image URL in place of bytes', () => {
    expect(() =>
      parseCompletionRequest(
        request({ attachments: [{ url: 'http://127.0.0.1/secret.png' }] }),
      ),
    ).toThrow();
  });

  it('rejects more images than a turn carries', () => {
    expect(() =>
      parseCompletionRequest(
        request({
          attachments: Array.from({ length: 5 }, () => ({
            mimeType: 'image/png',
            dataBase64: png,
          })),
        }),
      ),
    ).toThrow('A message carries at most 4 images.');
  });

  it('rejects an image beyond the per-image limit', () => {
    expect(() =>
      parseCompletionRequest(
        request({
          attachments: [
            { mimeType: 'image/png', dataBase64: 'A'.repeat(6_000_000) },
          ],
        }),
      ),
    ).toThrow('Each image must be at most 4 MiB.');
  });

  it('rejects images that are individually fine but too large together', () => {
    expect(() =>
      parseCompletionRequest(
        request({
          attachments: Array.from({ length: 4 }, () => ({
            mimeType: 'image/png',
            dataBase64: 'A'.repeat(5_200_000),
          })),
        }),
      ),
    ).toThrow('Images total at most 12 MiB per message.');
  });
});
