import { z } from 'zod';
import { base64ByteSize } from '@/lib/data-url';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export class CompletionRequestError extends Error {}

/**
 * Attachments are accepted as bytes and never as a URL. The inference server
 * resolves `image_url.url` against http(s) and the local filesystem, so any
 * caller-supplied string reaching that field would turn the server into an
 * SSRF and arbitrary-file-read primitive on the machine running the model.
 */
const attachmentSchema = z.object({
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    message: `An image must be one of ${ALLOWED_MIME_TYPES.join(', ')}.`,
  }),
  dataBase64: z
    .string()
    .min(1, { message: 'An image must carry data.' })
    .refine((value) => BASE64.test(value), {
      message: 'An image must be base64 encoded.',
    })
    .refine((value) => base64ByteSize(value) <= MAX_ATTACHMENT_BYTES, {
      message: `Each image must be at most ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MiB.`,
    }),
});

export const completionRequestSchema = z
  .object({
    conversationId: z.string().min(1).optional(),
    modelId: z.string().min(1, { message: 'modelId is required.' }),
    text: z.string().default(''),
    attachments: z
      .array(attachmentSchema)
      .max(MAX_ATTACHMENTS, {
        message: `A message carries at most ${MAX_ATTACHMENTS} images.`,
      })
      .default([]),
  })
  .transform((request) => ({ ...request, text: request.text.trim() }))
  .refine(
    (request) => request.text.length > 0 || request.attachments.length > 0,
    { message: 'Send some text or at least one image.' },
  )
  .refine(
    (request) =>
      request.attachments.reduce(
        (total, attachment) => total + base64ByteSize(attachment.dataBase64),
        0,
      ) <= MAX_TOTAL_ATTACHMENT_BYTES,
    {
      message: `Images total at most ${MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024} MiB per message.`,
    },
  );

export type CompletionRequest = z.infer<typeof completionRequestSchema>;

export function parseCompletionRequest(input: unknown): CompletionRequest {
  const result = completionRequestSchema.safeParse(input);

  if (!result.success) {
    throw new CompletionRequestError(
      result.error.issues[0]?.message ?? 'The request was not understood.',
    );
  }

  return result.data;
}
