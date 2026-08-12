import { toDataUrl } from '@/lib/data-url';
import type {
  CompletionContentPart,
  CompletionMessage,
} from '@/lib/inference/schema';
import type { HistoryMessage } from './history';

function describeOmittedImages(count: number) {
  return count === 1
    ? '[1 image was attached to this message and is not included in this request.]'
    : `[${count} images were attached to this message and are not included in this request.]`;
}

function withOmissionNotice(message: HistoryMessage) {
  if (message.imageCount === 0) {
    return message.content;
  }

  const notice = describeOmittedImages(message.imageCount);

  return message.content.length > 0
    ? `${message.content}\n\n${notice}`
    : notice;
}

function lastUserIndex(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'user') {
      return index;
    }
  }

  return -1;
}

/**
 * Image parts are emitted for the newest user turn only.
 *
 * The server collects images from every user message, flattens them into one
 * list, strips the image parts out of the message content, and hands
 * `num_images` to the chat template — which then places that many image tokens
 * by its own rule, typically all on the current turn. Sending history images
 * therefore misplaces them. Keeping the count equal to what the user just
 * attached is the only arrangement that holds whatever the template does.
 *
 * Older images stay in the database and stay visible in the transcript; only
 * the request is trimmed, and the model is told in words that it happened.
 */
export function buildCompletionMessages(
  history: HistoryMessage[],
): CompletionMessage[] {
  const newestUser = lastUserIndex(history);

  return history.map((message, index) => {
    if (message.role === 'assistant') {
      return { role: 'assistant', content: message.content };
    }

    if (index !== newestUser || message.images.length === 0) {
      return { role: 'user', content: withOmissionNotice(message) };
    }

    const parts: CompletionContentPart[] = message.images.map((image) => ({
      type: 'image_url',
      image_url: { url: toDataUrl(image.mimeType, image.dataBase64) },
    }));

    if (message.content.length > 0) {
      parts.push({ type: 'text', text: message.content });
    }

    return { role: 'user', content: parts };
  });
}
