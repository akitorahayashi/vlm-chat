import { prisma } from '@/lib/prisma';

export type TranscriptAttachment = {
  id: string;
  mimeType: string;
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

export type ConversationDetail = {
  id: string;
  title: string;
  modelId: string;
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
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      title: true,
      modelId: true,
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
            select: { id: true, mimeType: true },
          },
        },
      },
    },
  });
}
