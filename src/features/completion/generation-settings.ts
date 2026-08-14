import { z } from 'zod';

export type GenerationSettings = {
  temperature: number;
  maxTokens: number;
  topP: number;
  repetitionPenalty: number;
};

export const GENERATION_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.05 },
  maxTokens: { min: 128, max: 4096, step: 64 },
  topP: { min: 0.1, max: 1, step: 0.05 },
  repetitionPenalty: { min: 1, max: 2, step: 0.05 },
} as const;

export const DEFAULT_GENERATION_SETTINGS = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  repetitionPenalty: 1,
} satisfies GenerationSettings;

export const generationSettingsSchema = z.object({
  temperature: z
    .number({ message: 'Temperature must be a number.' })
    .min(GENERATION_LIMITS.temperature.min, {
      message: `Temperature must be between ${GENERATION_LIMITS.temperature.min} and ${GENERATION_LIMITS.temperature.max}.`,
    })
    .max(GENERATION_LIMITS.temperature.max, {
      message: `Temperature must be between ${GENERATION_LIMITS.temperature.min} and ${GENERATION_LIMITS.temperature.max}.`,
    }),
  maxTokens: z
    .number({ message: 'Max output tokens must be a number.' })
    .int({ message: 'Max output tokens must be an integer.' })
    .min(GENERATION_LIMITS.maxTokens.min, {
      message: `Max output tokens must be between ${GENERATION_LIMITS.maxTokens.min} and ${GENERATION_LIMITS.maxTokens.max}.`,
    })
    .max(GENERATION_LIMITS.maxTokens.max, {
      message: `Max output tokens must be between ${GENERATION_LIMITS.maxTokens.min} and ${GENERATION_LIMITS.maxTokens.max}.`,
    }),
  topP: z
    .number({ message: 'Top P must be a number.' })
    .min(GENERATION_LIMITS.topP.min, {
      message: `Top P must be between ${GENERATION_LIMITS.topP.min} and ${GENERATION_LIMITS.topP.max}.`,
    })
    .max(GENERATION_LIMITS.topP.max, {
      message: `Top P must be between ${GENERATION_LIMITS.topP.min} and ${GENERATION_LIMITS.topP.max}.`,
    }),
  repetitionPenalty: z
    .number({ message: 'Repetition penalty must be a number.' })
    .min(GENERATION_LIMITS.repetitionPenalty.min, {
      message: `Repetition penalty must be between ${GENERATION_LIMITS.repetitionPenalty.min} and ${GENERATION_LIMITS.repetitionPenalty.max}.`,
    })
    .max(GENERATION_LIMITS.repetitionPenalty.max, {
      message: `Repetition penalty must be between ${GENERATION_LIMITS.repetitionPenalty.min} and ${GENERATION_LIMITS.repetitionPenalty.max}.`,
    }),
});
