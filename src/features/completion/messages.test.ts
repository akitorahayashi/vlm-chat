import { describe, expect, it } from 'bun:test';
import type { HistoryMessage } from './history';
import { buildCompletionMessages } from './messages';

function user(content: string, images: string[] = []): HistoryMessage {
  return {
    role: 'user',
    content,
    imageCount: images.length,
    images: images.map((dataBase64) => ({ mimeType: 'image/png', dataBase64 })),
  };
}

/** An earlier turn: its images are counted, and their bytes are not read. */
function counted(content: string, imageCount: number): HistoryMessage {
  return { role: 'user', content, imageCount, images: [] };
}

function assistant(content: string): HistoryMessage {
  return { role: 'assistant', content, imageCount: 0, images: [] };
}

describe('building completion messages', () => {
  it('keeps the turn order and passes assistant text through', () => {
    expect(
      buildCompletionMessages([user('one'), assistant('two'), user('three')]),
    ).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
  });

  it('attaches images to the newest user turn as image_url objects', () => {
    const [message] = buildCompletionMessages([user('look', ['AAA'])]);

    expect(message).toEqual({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
        { type: 'text', text: 'look' },
      ],
    });
  });

  it('omits an empty text part when only images were sent', () => {
    const [message] = buildCompletionMessages([user('', ['AAA'])]);

    expect(message.content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    ]);
  });

  it('replaces images on earlier turns with a stated omission', () => {
    const built = buildCompletionMessages([
      counted('first', 2),
      assistant('a cat and a dog'),
      user('and this one?', ['CCC']),
    ]);

    expect(built[0]).toEqual({
      role: 'user',
      content:
        'first\n\n[2 images were attached to this message and are not included in this request.]',
    });
    expect(built[2].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,CCC' } },
      { type: 'text', text: 'and this one?' },
    ]);
  });

  it('words a single omitted image in the singular', () => {
    const [message] = buildCompletionMessages([
      counted('first', 1),
      user('second'),
    ]);

    expect(message.content).toBe(
      'first\n\n[1 image was attached to this message and is not included in this request.]',
    );
  });

  it('sends exactly as many images as the newest turn carries', () => {
    const built = buildCompletionMessages([
      counted('a', 1),
      user('b', ['BBB', 'CCC']),
    ]);

    const images = built.flatMap((message) =>
      Array.isArray(message.content)
        ? message.content.filter((part) => part.type === 'image_url')
        : [],
    );

    expect(images).toHaveLength(2);
  });
});
