import { describe, expect, it } from 'bun:test';
import { base64ByteSize, parseDataUrl, toDataUrl } from './data-url';

describe('data urls', () => {
  it('round-trips a mime type and payload', () => {
    expect(parseDataUrl(toDataUrl('image/png', 'AAECAw=='))).toEqual({
      mimeType: 'image/png',
      dataBase64: 'AAECAw==',
    });
  });

  it('rejects anything that is not a base64 data URL', () => {
    expect(() => parseDataUrl('https://example.com/cat.png')).toThrow(
      'Expected a base64 data URL.',
    );
  });
});

describe('base64 size', () => {
  it('matches the decoded byte length', () => {
    for (const bytes of [[], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4]]) {
      const encoded = Buffer.from(bytes).toString('base64');

      expect(base64ByteSize(encoded)).toBe(bytes.length);
    }
  });
});
