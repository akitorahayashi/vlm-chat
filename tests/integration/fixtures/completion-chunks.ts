import { chunk } from '../../fixtures/completion-wire';

export const contentOnlyStream = [
  chunk({ content: 'Hel' }),
  chunk({ content: 'lo' }),
  chunk({}, 'stop'),
  '[DONE]',
];

export const reasoningThenContentStream = [
  chunk({ reasoning_content: 'weighing options' }),
  chunk({ content: 'Blue.' }),
  chunk({}, 'stop'),
  '[DONE]',
];

export const midStreamErrorStream = [
  chunk({ content: 'Partial' }),
  '{"error":"the model ran out of memory"}',
];

export const truncatedStream = [chunk({ content: 'Cut' })];

export const slowStream = [
  chunk({ content: 'one ' }),
  chunk({ content: 'two ' }),
  chunk({ content: 'three ' }),
  chunk({ content: 'four' }),
  chunk({}, 'stop'),
  '[DONE]',
];
