import { prisma } from '@/lib/prisma';

export type AssistantOutcome = 'complete' | 'aborted' | 'failed';

/**
 * The only writer of an assistant turn's terminal state. Content and reasoning
 * are accumulated for the whole stream and written once: a write per delta
 * would amplify SQLite traffic without making any reader better off, since a
 * turn is only readable after the stream that produced it ends.
 */
export async function closeAssistantMessage(input: {
  messageId: string;
  content: string;
  reasoning: string;
  status: AssistantOutcome;
  finishReason?: string | null;
  errorMessage?: string | null;
}) {
  await prisma.message.update({
    where: { id: input.messageId },
    data: {
      content: input.content,
      reasoning: input.reasoning.length > 0 ? input.reasoning : null,
      status: input.status,
      finishReason: input.finishReason ?? null,
      errorMessage: input.errorMessage ?? null,
      completedAt: new Date(),
    },
  });
}
