import { describe, expect, it } from 'bun:test';
import { deriveConversationTitle } from './title';

describe('deriving a conversation title', () => {
  it('collapses whitespace in the first message', () => {
    expect(deriveConversationTitle('  what   is\nthis?  ', 0)).toBe(
      'what is this?',
    );
  });

  it('truncates a long message', () => {
    const title = deriveConversationTitle('x'.repeat(200), 0);

    expect(title).toHaveLength(60);
    expect(title.endsWith('…')).toBe(true);
  });

  it('names the images when there is no text', () => {
    expect(deriveConversationTitle('', 1)).toBe('1 image');
    expect(deriveConversationTitle('   ', 3)).toBe('3 images');
  });
});
