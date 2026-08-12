import { readAttachment } from '@/features/attachment/read';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await context.params;
  const attachment = await readAttachment(attachmentId);

  if (!attachment) {
    return Response.json(
      { error: `No attachment with id ${attachmentId}.` },
      { status: 404 },
    );
  }

  return new Response(new Uint8Array(attachment.data), {
    headers: {
      'Content-Type': attachment.mimeType,
      // Bytes under a given id never change, and serving them from this origin
      // is what keeps stored images inside `img-src 'self'`.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
