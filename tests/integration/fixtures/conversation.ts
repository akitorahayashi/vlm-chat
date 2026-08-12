import './database';

/** Starts a conversation and fails loudly rather than handing back a null id. */
export async function startConversation(title: string, modelId = 'a/b') {
  const { resolveConversation } = await import(
    '@/features/conversation/resolve'
  );
  const conversation = await resolveConversation({ modelId, title });

  if (!conversation) {
    throw new Error(`The fixture could not start the conversation ${title}.`);
  }

  return conversation.id;
}
