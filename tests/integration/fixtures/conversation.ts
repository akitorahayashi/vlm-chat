import './database';
import {
  DEFAULT_GENERATION_SETTINGS,
  type GenerationSettings,
} from '@/features/completion/generation-settings';

/** Starts a conversation and fails loudly rather than handing back a null id. */
export async function startConversation(
  title: string,
  modelId = 'a/b',
  generation: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
) {
  const { resolveConversation } = await import(
    '@/features/conversation/resolve'
  );
  const conversation = await resolveConversation({
    modelId,
    title,
    generation,
  });

  if (!conversation) {
    throw new Error(`The fixture could not start the conversation ${title}.`);
  }

  return conversation.id;
}
