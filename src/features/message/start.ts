import type { GenerationSettings } from '@/features/completion/generation-settings';
import { prisma } from '@/lib/prisma';
import { nextSequence } from './next-sequence';

export async function startAssistantMessage(input: {
  conversationId: string;
  modelId: string;
  seed: number;
  generation: GenerationSettings;
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
        ...input.generation,
      },
      select: { id: true },
    });
  });
}
