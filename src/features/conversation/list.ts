import { prisma } from '@/lib/prisma';

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: Date;
};

export async function listConversations(): Promise<ConversationSummary[]> {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true },
  });
}
