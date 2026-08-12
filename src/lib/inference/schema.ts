import { z } from 'zod';

export type CompletionContentPart =
  | { type: 'text'; text: string }
  // Typed as an object so a bare string can never be constructed here: mlx-vlm
  // reads `item["image_url"]["url"]` and answers a string with a 500, not a 400.
  | { type: 'image_url'; image_url: { url: string } };

export type CompletionMessage =
  | { role: 'user'; content: string | CompletionContentPart[] }
  | { role: 'assistant'; content: string };

export type ChatCompletionBody = {
  model: string;
  messages: CompletionMessage[];
  stream: true;
  seed: number;
  temperature: number;
  max_tokens: number;
};

/**
 * Only the fields this app reads are validated. `/v1/models` carries `object`
 * and `created` too, but asserting them would make the client brittle against a
 * server that is otherwise answering correctly.
 */
export const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) })),
});

/**
 * `choices` is required rather than defaulted: with a fallback, any JSON object
 * at all parses as a chunk carrying nothing, and an unrecognized payload would
 * be skipped instead of ending the turn with the reason.
 */
export const completionChunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z
        .object({
          content: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          reasoning: z.string().nullish(),
        })
        .optional(),
      finish_reason: z.string().nullish(),
    }),
  ),
});

export const streamErrorSchema = z.object({
  error: z.union([z.string(), z.object({ message: z.string() })]),
});

export function describeStreamError(error: z.infer<typeof streamErrorSchema>) {
  return typeof error.error === 'string' ? error.error : error.error.message;
}
