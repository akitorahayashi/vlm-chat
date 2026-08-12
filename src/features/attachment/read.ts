import { prisma } from '@/lib/prisma';

export async function readAttachment(attachmentId: string) {
  return prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { mimeType: true, data: true },
  });
}
