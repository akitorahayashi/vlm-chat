import { deleteConversation } from '@/features/conversation/delete';
import { cancelConversationCompletion } from '@/lib/running-completions';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;

  // Stopped first: the rows cascade with the conversation, and a turn still
  // generating into them would otherwise keep the model busy producing text
  // with nowhere left to put it.
  cancelConversationCompletion(conversationId);

  if (!(await deleteConversation(conversationId))) {
    return Response.json(
      { error: `No conversation with id ${conversationId}.` },
      { status: 404 },
    );
  }

  return new Response(null, { status: 204 });
}
