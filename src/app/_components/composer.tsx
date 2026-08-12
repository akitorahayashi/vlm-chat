import { type DragEvent, type FormEvent, useRef, useState } from 'react';
import {
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENTS,
} from '@/features/completion/parse';
import type { DraftImage } from '@/lib/image-downscale';
import { AttachmentTray } from './attachment-tray';

export function Composer({
  draft,
  images,
  streaming,
  canSend,
  onDraftChange,
  onFiles,
  onRemoveImage,
  onSubmit,
  onStop,
}: {
  draft: string;
  images: DraftImage[];
  streaming: boolean;
  canSend: boolean;
  onDraftChange: (value: string) => void;
  onFiles: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
  onSubmit: () => void;
  onStop: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (canSend) {
      onSubmit();
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-t px-1 py-4 ${
        dragging ? 'border-emerald-500' : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <AttachmentTray images={images} onRemove={onRemoveImage} />

      <textarea
        value={draft}
        rows={3}
        aria-label="Message"
        placeholder="Ask something. Paste or drop an image to ask about it."
        onChange={(event) => onDraftChange(event.target.value)}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);

          if (files.length > 0) {
            event.preventDefault();
            onFiles(files);
          }
        }}
        className="w-full resize-y border border-zinc-300 bg-white px-3 py-2 text-base leading-6 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={images.length >= MAX_ATTACHMENTS}
          className="border border-zinc-300 px-3 py-1.5 font-mono text-xs uppercase disabled:opacity-50 dark:border-zinc-700"
        >
          Attach image
        </button>

        <input
          ref={fileInput}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />

        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="bg-zinc-900 px-4 py-1.5 font-mono text-xs uppercase text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="bg-emerald-600 px-4 py-1.5 font-mono text-xs uppercase text-white disabled:opacity-50"
          >
            Send
          </button>
        )}
      </div>
    </form>
  );
}
