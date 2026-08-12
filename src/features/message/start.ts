import { prisma } from '@/lib/prisma';
import { nextSequence } from './next-sequence';

export async function startAssistantMessage(input: {
  conversationId: string;
  modelId: string;
  seed: number;
}) {
  return prisma.$transaction(async (tx) => {
    const sequence = await nextSequence(tx, input.conversationId);

    return tx.message.create({
      data: {
        conversationId: input.conversationId,
        sequence,
        role: 'assistant',
        status: 'streaming',
        modelId: input.modelId,
        seed: input.seed,
      },
      select: { id: true },
    });
  });
}
