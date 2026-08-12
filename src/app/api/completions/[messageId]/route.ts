import { cancelCompletion } from '@/lib/running-completions';

export const dynamic = 'force-dynamic';

/**
 * Answers 200 whether or not anything was running. Stopping a turn that has
 * already finished is the normal race, not a failure, and a 404 here would only
 * add noise to the browser console.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params;

  return Response.json({ cancelled: cancelCompletion(messageId) });
}
