const MAX_TITLE_LENGTH = 60;

export function deriveConversationTitle(text: string, imageCount: number) {
  const collapsed = text.replace(/\s+/g, ' ').trim();

  if (collapsed.length === 0) {
    return imageCount === 1 ? '1 image' : `${imageCount} images`;
  }

  return collapsed.length <= MAX_TITLE_LENGTH
    ? collapsed
    : `${collapsed.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}
