import { describe, expect, it } from 'bun:test';
import { DEFAULT_GENERATION_SETTINGS } from '@/features/completion/generation-settings';
import { startConversation } from './fixtures/conversation';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function get(attachmentId: string) {
  const { GET } = await import('@/app/api/attachments/[attachmentId]/route');

  return GET(new Request(`http://localhost/api/attachments/${attachmentId}`), {
    params: Promise.resolve({ attachmentId }),
  });
}

describe('attachment route', () => {
  it('serves the stored bytes with their own mime type', async () => {
    const { appendUserMessage } = await import('@/features/message/append');
    const { prisma } = await import('@/lib/prisma');

    const conversationId = await startConversation('image');
    const message = await appendUserMessage({
      conversationId,
      modelId: 'a/b',
      generation: DEFAULT_GENERATION_SETTINGS,
      text: '',
      attachments: [
        {
          mimeType: 'image/png',
          dataBase64: Buffer.from(png).toString('base64'),
        },
      ],
    });
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: { messageId: message.id },
    });

    const response = await get(attachment.id);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(
      Buffer.from(await response.arrayBuffer()).equals(Buffer.from(png)),
    ).toBe(true);
  });

  it('reports an unknown attachment', async () => {
    expect((await get('missing')).status).toBe(404);
  });
});
