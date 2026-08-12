import { describe, expect, it } from 'bun:test';
import { buildChatCompletionRequest, drawSeed } from './request';

const messages = [{ role: 'user' as const, content: 'hello' }];

describe('building a chat completion request', () => {
  it('always names the model and asks for a stream', () => {
    const body = buildChatCompletionRequest({
      modelId: 'mlx-community/Example-4bit',
      messages,
      seed: 7,
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
    });

    expect(body.temperature).toBeGreaterThan(0);
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.seed).toBe(7);
  });

  it('does not send enable_thinking', () => {
    const body = buildChatCompletionRequest({
      modelId: 'm',
      messages,
      seed: 7,
    });

    expect(Object.keys(body)).not.toContain('enable_thinking');
  });

  it('draws a seed that varies between requests', () => {
    const seeds = new Set(Array.from({ length: 32 }, () => drawSeed()));

    expect(seeds.size).toBeGreaterThan(1);
  });
});
