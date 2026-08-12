import { z } from 'zod';

/**
 * The protocol between this app's chat route handler and its browser client.
 * It imports nothing but zod so a client component can decode events without
 * pulling Prisma into the bundle.
 */
export const chatEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    conversationId: z.string(),
    userMessageId: z.string(),
    assistantMessageId: z.string(),
    modelId: z.string(),
  }),
  z.object({
    type: z.literal('delta'),
    content: z.string().optional(),
    reasoning: z.string().optional(),
  }),
  z.object({
    type: z.literal('end'),
    finishReason: z.string().nullable(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;

export function encodeChatEvent(event: ChatEvent) {
  return JSON.stringify(event);
}

export async function* encodeChatEvents(
  source: AsyncIterable<ChatEvent>,
): AsyncGenerator<string> {
  for await (const event of source) {
    yield encodeChatEvent(event);
  }
}

export function decodeChatEvent(payload: string): ChatEvent {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error(`Received a chat event that is not JSON: ${payload}`);
  }

  const result = chatEventSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Received an unrecognized chat event: ${payload}`);
  }

  return result.data;
}
