import { base64ByteSize, parseDataUrl } from './data-url';

const MAX_EDGE = 1024;
const OUTPUT_MIME = 'image/jpeg' as const;
const OUTPUT_QUALITY = 0.85;

export type DraftImage = {
  /**
   * Identity for the render, not for storage. Two attachments of the same file
   * are byte-identical, so nothing about the image itself distinguishes them.
   */
  id: string;
  mimeType: typeof OUTPUT_MIME;
  dataBase64: string;
  dataUrl: string;
  byteSize: number;
};

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('The file is not a readable image.'));
    image.src = source;
  });
}

/**
 * Reads through a data URL rather than `URL.createObjectURL`: the app's CSP
 * allows `img-src 'self' data:`, so a `blob:` preview would never render.
 *
 * Re-encoding as JPEG normalizes whatever the browser accepted into one of the
 * mime types the upload schema allows. A 12MP photo is otherwise several MB in
 * the request body, in SQLite and in the model's prefill, and the server
 * resizes it anyway.
 */
export async function downscaleImage(file: File): Promise<DraftImage> {
  const image = await loadImage(await readAsDataUrl(file));
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('This browser did not provide a 2D canvas context.');
  }

  // JPEG has no alpha channel, so transparent regions would otherwise composite
  // onto black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL(OUTPUT_MIME, OUTPUT_QUALITY);
  const { dataBase64 } = parseDataUrl(dataUrl);

  return {
    id: crypto.randomUUID(),
    mimeType: OUTPUT_MIME,
    dataBase64,
    dataUrl,
    byteSize: base64ByteSize(dataBase64),
  };
}
