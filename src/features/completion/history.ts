import { prisma } from '@/lib/prisma';

export type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** Images attached to the turn, whether or not their bytes were read. */
  imageCount: number;
  /** The bytes, present only where the request will actually carry them. */
  images: { mimeType: string; dataBase64: string }[];
};

/**
 * A failed turn is left out of the prompt: it holds whatever partial text
 * arrived before the server reported an error, which is not something the model
 * should be asked to continue from. An interrupted turn is kept, because the
 * user stopped it deliberately and can still refer to what it said.
 *
 * Bytes are read for the newest user turn only, because that is the only turn
 * whose images are sent — see `buildCompletionMessages`. Reading the rest would
 * pull every image in the conversation out of SQLite and base64 it once per
 * request to then discard it, and the cost grows with the conversation.
 */
export async function readCompletionHistory(
  conversationId: string,
): Promise<HistoryMessage[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId, status: { in: ['complete', 'aborted'] } },
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      _count: { select: { attachments: true } },
    },
  });

  const carried = messages.filter(
    (message) => message.content.length > 0 || message._count.attachments > 0,
  );
  const newestUser = carried.findLast(
    (message) => message.role !== 'assistant',
  );

  const attachments =
    newestUser && newestUser._count.attachments > 0
      ? await prisma.attachment.findMany({
          where: { messageId: newestUser.id },
          orderBy: { position: 'asc' },
          select: { mimeType: true, data: true },
        })
      : [];

  return carried.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    imageCount: message._count.attachments,
    images:
      message.id === newestUser?.id
        ? attachments.map((attachment) => ({
            mimeType: attachment.mimeType,
            dataBase64: Buffer.from(attachment.data).toString('base64'),
          }))
        : [],
  }));
}
