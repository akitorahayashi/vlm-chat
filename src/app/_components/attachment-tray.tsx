import type { DraftImage } from '@/lib/image-downscale';

export function AttachmentTray({
  images,
  onRemove,
}: {
  images: DraftImage[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) {
    return null;
  }

  return (
    <ul data-testid="attachment-tray" className="flex flex-wrap gap-2 pb-3">
      {images.map((image, index) => (
        <li key={image.dataUrl} className="relative">
          {/** biome-ignore lint/performance/noImgElement: a data URL preview is
           * what the app's img-src policy allows; blob: is not permitted. */}
          <img
            src={image.dataUrl}
            alt="Pending attachment"
            className="size-20 border border-zinc-300 object-cover dark:border-zinc-700"
          />
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={() => onRemove(index)}
            className="absolute right-0 top-0 bg-zinc-900 px-1.5 font-mono text-xs text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
