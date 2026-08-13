import type { GenerationSettings } from '@/features/completion/generation-settings';
import { prisma } from '@/lib/prisma';

type TranscriptAttachment = {
  id: string;
};

export type TranscriptMessage = {
  id: string;
  role: string;
  content: string;
  reasoning: string | null;
  status: string;
  errorMessage: string | null;
  modelId: string | null;
  attachments: TranscriptAttachment[];
};

type ConversationDetail = {
  id: string;
  title: string;
  modelId: string;
  generation: GenerationSettings;
  messages: TranscriptMessage[];
};

/**
 * Attachment bytes are left out on purpose: the transcript renders them through
 * `/api/attachments/<id>`, so inlining them would put every image of a long
 * conversation into the server-rendered payload.
 */
export async function readConversation(
  conversationId: string,
): Promise<ConversationDetail | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      title: true,
      modelId: true,
      temperature: true,
      maxTokens: true,
      topP: true,
      repetitionPenalty: true,
      messages: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          reasoning: true,
          status: true,
          errorMessage: true,
          modelId: true,
          attachments: {
            orderBy: { position: 'asc' },
            select: { id: true },
          },
        },
      },
    },
  });

  if (conversation === null) {
    return null;
  }

  return {
    id: conversation.id,
    title: conversation.title,
    modelId: conversation.modelId,
    generation: {
      temperature: conversation.temperature,
      maxTokens: conversation.maxTokens,
      topP: conversation.topP,
      repetitionPenalty: conversation.repetitionPenalty,
    },
    messages: conversation.messages,
  };
}
