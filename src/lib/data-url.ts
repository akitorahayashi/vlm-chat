const BASE64_DATA_URL = /^data:([^;,]+);base64,([\s\S]*)$/;

export function toDataUrl(mimeType: string, dataBase64: string) {
  return `data:${mimeType};base64,${dataBase64}`;
}

export function parseDataUrl(dataUrl: string) {
  const match = BASE64_DATA_URL.exec(dataUrl);

  if (!match) {
    throw new Error('Expected a base64 data URL.');
  }

  return { mimeType: match[1], dataBase64: match[2] };
}

/** Decoded size of a base64 payload, without allocating the bytes. */
export function base64ByteSize(dataBase64: string) {
  const padding = dataBase64.endsWith('==')
    ? 2
    : dataBase64.endsWith('=')
      ? 1
      : 0;

  return Math.floor((dataBase64.length * 3) / 4) - padding;
}
