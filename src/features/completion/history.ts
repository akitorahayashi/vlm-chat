import { prisma } from '@/lib/prisma';

export type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  images: { mimeType: string; dataBase64: string }[];
};

/**
 * A failed turn is left out of the prompt: it holds whatever partial text
 * arrived before the server reported an error, which is not something the model
 * should be asked to continue from. An interrupted turn is kept, because the
 * user stopped it deliberately and can still refer to what it said.
 */
export async function readCompletionHistory(
  conversationId: string,
): Promise<HistoryMessage[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId, status: { in: ['complete', 'aborted'] } },
    orderBy: { sequence: 'asc' },
    select: {
      role: true,
      content: true,
      attachments: {
        orderBy: { position: 'asc' },
        select: { mimeType: true, data: true },
      },
    },
  });

  return messages
    .filter(
      (message) => message.content.length > 0 || message.attachments.length > 0,
    )
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
      images: message.attachments.map((attachment) => ({
        mimeType: attachment.mimeType,
        dataBase64: Buffer.from(attachment.data).toString('base64'),
      })),
    }));
}
