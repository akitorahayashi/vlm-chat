import { describe, expect, it } from 'bun:test';
import { startConversation } from './fixtures/conversation';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x0d, 0x1a]);

const pngBase64 = Buffer.from(png).toString('base64');

describe('conversation database', () => {
  it('stores attachment bytes without changing them', async () => {
    const { appendUserMessage } = await import('@/features/message/append');
    const { readAttachment } = await import('@/features/attachment/read');
    const { prisma } = await import('@/lib/prisma');

    const conversationId = await startConversation('bytes');
    const message = await appendUserMessage({
      conversationId,
      modelId: 'a/b',
      text: 'look',
      attachments: [{ mimeType: 'image/png', dataBase64: pngBase64 }],
    });

    const stored = await prisma.attachment.findFirstOrThrow({
      where: { messageId: message.id },
    });
    const reread = await readAttachment(stored.id);

    expect(reread).not.toBeNull();
    expect(Buffer.from(reread?.data ?? []).equals(Buffer.from(png))).toBe(true);
    expect(stored.byteSize).toBe(png.byteLength);
  });

  it('numbers turns in the order they were written', async () => {
    const { appendUserMessage } = await import('@/features/message/append');
    const { startAssistantMessage } = await import('@/features/message/start');
    const { prisma } = await import('@/lib/prisma');

    const conversationId = await startConversation('order');

    await appendUserMessage({
      conversationId,
      modelId: 'a/b',
      text: 'first',
      attachments: [],
    });
    await startAssistantMessage({ conversationId, modelId: 'a/b', seed: 1 });
    await appendUserMessage({
      conversationId,
      modelId: 'a/b',
      text: 'second',
      attachments: [],
    });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { sequence: 'asc' },
      select: { sequence: true, role: true },
    });

    expect(messages.map((message) => message.sequence)).toEqual([0, 1, 2]);
    expect(messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);
  });

  it('orders the conversation list by most recent activity', async () => {
    const { appendUserMessage } = await import('@/features/message/append');
    const { listConversations } = await import('@/features/conversation/list');

    // Timestamps are millisecond-resolution, so three writes in the same
    // millisecond would tie and the order would say nothing.
    const older = await startConversation('older');
    await Bun.sleep(5);
    const newer = await startConversation('newer');
    await Bun.sleep(5);

    await appendUserMessage({
      conversationId: older,
      modelId: 'a/b',
      text: 'revived',
      attachments: [],
    });

    const listed = (await listConversations()).map(
      (conversation) => conversation.id,
    );

    // Both ids first: two missing ones would compare as -1 < -1 and a single
    // missing one as -1 < n, so the comparison alone can pass without listing
    // anything.
    expect(listed).toContain(older);
    expect(listed).toContain(newer);
    expect(listed.indexOf(older)).toBeLessThan(listed.indexOf(newer));
  });

  it('records the model that was in effect for the turn', async () => {
    const { appendUserMessage } = await import('@/features/message/append');
    const { prisma } = await import('@/lib/prisma');

    const conversationId = await startConversation('switch', 'first/model');

    await appendUserMessage({
      conversationId,
      modelId: 'second/model',
      text: 'switched',
      attachments: [],
    });

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    expect(conversation.modelId).toBe('second/model');
  });

  it('removes messages and attachments with the conversation', async () => {
    const { deleteConversation } = await import(
      '@/features/conversation/delete'
    );
    const { appendUserMessage } = await import('@/features/message/append');
    const { prisma } = await import('@/lib/prisma');

    const conversationId = await startConversation('cascade');
    const message = await appendUserMessage({
      conversationId,
      modelId: 'a/b',
      text: 'doomed',
      attachments: [{ mimeType: 'image/png', dataBase64: pngBase64 }],
    });

    expect(await deleteConversation(conversationId)).toBe(true);
    expect(await prisma.message.count({ where: { conversationId } })).toBe(0);
    expect(
      await prisma.attachment.count({ where: { messageId: message.id } }),
    ).toBe(0);
    expect(await deleteConversation(conversationId)).toBe(false);
  });

  it('reports an unknown conversation instead of starting a new one', async () => {
    const { resolveConversation } = await import(
      '@/features/conversation/resolve'
    );

    expect(
      await resolveConversation({
        conversationId: 'missing',
        modelId: 'a/b',
        title: 'ignored',
      }),
    ).toBeNull();
  });
});
