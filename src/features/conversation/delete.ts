import { prisma } from '@/lib/prisma';

/** Returns false when nothing matched, so the caller can answer 404 itself. */
export async function deleteConversation(conversationId: string) {
  const result = await prisma.conversation.deleteMany({
    where: { id: conversationId },
  });

  return result.count > 0;
}
