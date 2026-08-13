import type { ChatCompletionBody, CompletionMessage } from './schema';

// Sent explicitly rather than relying on the server's own defaults, which are
// temperature 0.0 and max_tokens 2048 and are free to move between releases.
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;

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
}): ChatCompletionBody {
  return {
    model: input.modelId,
    messages: input.messages,
    stream: true,
    seed: input.seed,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: DEFAULT_MAX_TOKENS,
  };
}
