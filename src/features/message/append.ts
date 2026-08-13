import type { GenerationSettings } from '@/features/completion/generation-settings';
import { prisma } from '@/lib/prisma';
import { nextSequence } from './next-sequence';

/**
 * Also stamps the conversation with the model in effect for this turn, which
 * bumps `updatedAt` so the conversation list orders by activity rather than by
 * creation.
 */
export async function appendUserMessage(input: {
  conversationId: string;
  modelId: string;
  generation: GenerationSettings;
  text: string;
  attachments: { mimeType: string; dataBase64: string }[];
}) {
  return prisma.$transaction(async (tx) => {
    const sequence = await nextSequence(tx, input.conversationId);

    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { modelId: input.modelId, ...input.generation },
    });

    return tx.message.create({
      data: {
        conversationId: input.conversationId,
        sequence,
        role: 'user',
        content: input.text,
        status: 'complete',
        completedAt: new Date(),
        attachments: {
          create: input.attachments.map((attachment, position) => {
            const data = Buffer.from(attachment.dataBase64, 'base64');

            return {
              position,
              mimeType: attachment.mimeType,
              data,
              byteSize: data.byteLength,
            };
          }),
        },
      },
      select: { id: true },
    });
  });
}
