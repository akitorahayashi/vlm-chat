import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_GENERATION_SETTINGS,
  generationSettingsSchema,
} from './generation-settings';

describe('generation settings', () => {
  it('uses the established chat defaults', () => {
    expect(DEFAULT_GENERATION_SETTINGS).toEqual({
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1,
      repetitionPenalty: 1,
    });
  });

  it('accepts every supported boundary', () => {
    expect(
      generationSettingsSchema.safeParse({
        temperature: 0,
        maxTokens: 128,
        topP: 0.1,
        repetitionPenalty: 1,
      }).success,
    ).toBe(true);
    expect(
      generationSettingsSchema.safeParse({
        temperature: 2,
        maxTokens: 4096,
        topP: 1,
        repetitionPenalty: 2,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['temperature', -0.01],
    ['temperature', 2.01],
    ['maxTokens', 127],
    ['maxTokens', 4097],
    ['topP', 0.09],
    ['topP', 1.01],
    ['repetitionPenalty', 0.99],
    ['repetitionPenalty', 2.01],
  ] as const)('rejects an unsupported %s', (field, value) => {
    expect(
      generationSettingsSchema.safeParse({
        ...DEFAULT_GENERATION_SETTINGS,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it('requires max output tokens to be an integer', () => {
    expect(
      generationSettingsSchema.safeParse({
        ...DEFAULT_GENERATION_SETTINGS,
        maxTokens: 128.5,
      }).success,
    ).toBe(false);
  });

  it('does not coerce numeric strings', () => {
    expect(
      generationSettingsSchema.safeParse({
        ...DEFAULT_GENERATION_SETTINGS,
        temperature: '0.7',
      }).success,
    ).toBe(false);
  });
});
