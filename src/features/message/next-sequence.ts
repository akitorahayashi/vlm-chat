import type { Prisma } from '@/generated/prisma/client';

/**
 * Called inside a transaction so two turns written close together cannot claim
 * the same position; `@@unique([conversationId, sequence])` is the backstop.
 */
export async function nextSequence(
  tx: Prisma.TransactionClient,
  conversationId: string,
) {
  const highest = await tx.message.aggregate({
    where: { conversationId },
    _max: { sequence: true },
  });

  return (highest._max.sequence ?? -1) + 1;
}
