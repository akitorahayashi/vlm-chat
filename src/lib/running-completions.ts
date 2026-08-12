/**
 * In-flight completions, so a browser that stops reading can stop the model.
 *
 * Cancellation cannot be left to the transport: under `next dev` the incoming
 * request's `signal` never fires when the browser aborts its fetch, and the
 * response stream's `cancel` is not reached either, so an abandoned turn would
 * keep generating to the end. The client says stop explicitly instead, and this
 * is what that request reaches.
 */
const running = new Map<string, AbortController>();

export function registerCompletion(
  messageId: string,
  controller: AbortController,
) {
  running.set(messageId, controller);
}

export function releaseCompletion(messageId: string) {
  running.delete(messageId);
}

export function cancelCompletion(messageId: string) {
  const controller = running.get(messageId);

  if (!controller) {
    return false;
  }

  controller.abort();
  running.delete(messageId);

  return true;
}
