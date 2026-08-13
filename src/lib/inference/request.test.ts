import { describe, expect, it } from 'bun:test';
import { DEFAULT_GENERATION_SETTINGS } from '@/features/completion/generation-settings';
import { buildChatCompletionRequest, drawSeed } from './request';

const messages = [{ role: 'user' as const, content: 'hello' }];

describe('building a chat completion request', () => {
  it('always names the model and asks for a stream', () => {
    const body = buildChatCompletionRequest({
      modelId: 'mlx-community/Example-4bit',
      messages,
      seed: 7,
      generation: DEFAULT_GENERATION_SETTINGS,
    });

    expect(body.model).toBe('mlx-community/Example-4bit');
    expect(body.stream).toBe(true);
    expect(body.messages).toEqual(messages);
  });

  it('states sampling parameters instead of inheriting server defaults', () => {
    const body = buildChatCompletionRequest({
      modelId: 'm',
      messages,
      seed: 7,
      generation: {
        temperature: 1.25,
        maxTokens: 512,
        topP: 0.8,
        repetitionPenalty: 1.15,
      },
    });

    expect(body).toMatchObject({
      seed: 7,
      temperature: 1.25,
      max_tokens: 512,
      top_p: 0.8,
      repetition_penalty: 1.15,
    });
  });

  it('does not send enable_thinking', () => {
    const body = buildChatCompletionRequest({
      modelId: 'm',
      messages,
      seed: 7,
      generation: DEFAULT_GENERATION_SETTINGS,
    });

    expect(Object.keys(body)).not.toContain('enable_thinking');
  });

  it('draws a seed that varies between requests', () => {
    const seeds = new Set(Array.from({ length: 32 }, () => drawSeed()));

    expect(seeds.size).toBeGreaterThan(1);
  });
});
