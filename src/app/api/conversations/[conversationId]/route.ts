import { deleteConversation } from '@/features/conversation/delete';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;

  if (!(await deleteConversation(conversationId))) {
    return Response.json(
      { error: `No conversation with id ${conversationId}.` },
      { status: 404 },
    );
  }

  return new Response(null, { status: 204 });
}
