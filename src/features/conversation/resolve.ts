import { prisma } from '@/lib/prisma';

/**
 * Finds the conversation a turn belongs to, starting one when the client did
 * not name any. Returns null for an id that does not exist so the caller can
 * answer 404 rather than silently opening a different conversation.
 */
export async function resolveConversation(input: {
  conversationId?: string;
  modelId: string;
  title: string;
}) {
  if (!input.conversationId) {
    return prisma.conversation.create({
      data: { modelId: input.modelId, title: input.title },
      select: { id: true },
    });
  }

  return prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true },
  });
}
