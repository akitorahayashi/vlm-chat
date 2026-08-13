import type { GenerationSettings } from '@/features/completion/generation-settings';
import type { ChatCompletionBody, CompletionMessage } from './schema';

/**
 * mlx-vlm defaults `seed` to 0, so without a fresh value every identical
 * request returns byte-identical output even at temperature > 0.
 */
export function drawSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * `enable_thinking` is deliberately absent. Thinking is decided by which model
 * the user picked: a Thinking template opens the block itself, which is what
 * makes the server split `reasoning_content` from `content`. Since the model
 * list is whatever sits in the local HuggingFace cache, this app cannot say
 * what the flag would do to an arbitrary template, so it does not send it.
 */
export function buildChatCompletionRequest(input: {
  modelId: string;
  messages: CompletionMessage[];
  seed: number;
  generation: GenerationSettings;
}): ChatCompletionBody {
  return {
    model: input.modelId,
    messages: input.messages,
    stream: true,
    seed: input.seed,
    temperature: input.generation.temperature,
    max_tokens: input.generation.maxTokens,
    top_p: input.generation.topP,
    repetition_penalty: input.generation.repetitionPenalty,
  };
}
