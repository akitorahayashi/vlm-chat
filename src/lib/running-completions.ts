type Running = {
  conversationId: string;
  controller: AbortController;
};

type Registry = {
  /** Keyed by the id the browser chose for the request. */
  running: Map<string, Running>;
  /** One completion per conversation, so history is never built mid-turn. */
  byConversation: Map<string, string>;
};

const globalForCompletions = globalThis as unknown as {
  runningCompletions?: Registry;
};

/**
 * The completions this process is generating.
 *
 * Cancellation cannot be left to the transport: under `next dev` the incoming
 * request's `signal` never fires when the browser aborts its fetch, and the
 * response stream's `cancel` is not reached either, so an abandoned turn would
 * keep generating to the end. The client says stop explicitly instead, and this
 * is what that request reaches.
 *
 * Held on `globalThis` rather than in module scope, the way `src/lib/prisma.ts`
 * holds its client: the dev server gives each route its own copy of this module,
 * so module-scoped maps would leave `/api/chat` and
 * `/api/completions/[completionId]` registering into and reading from different
 * ones. A stop request would then answer `cancelled: false` while the turn it
 * named generated to the end and was stored as though it had completed.
 *
 * The id comes from the client rather than being the assistant message's, so
 * that a turn can be cancelled during the seconds — sometimes tens of them —
 * that the server spends reading a model off disk, long before any message row
 * exists to name.
 */
const registry: Registry = globalForCompletions.runningCompletions ?? {
  running: new Map(),
  byConversation: new Map(),
};

globalForCompletions.runningCompletions = registry;

const { running, byConversation } = registry;

/**
 * Takes both the completion id and the conversation, or reports that the
 * conversation is busy. Claiming is synchronous on purpose: it is what makes
 * two overlapping requests resolve in a defined order.
 */
export function claimCompletion(input: {
  completionId: string;
  conversationId: string;
  controller: AbortController;
}) {
  if (byConversation.has(input.conversationId)) {
    return false;
  }

  running.set(input.completionId, {
    conversationId: input.conversationId,
    controller: input.controller,
  });
  byConversation.set(input.conversationId, input.completionId);

  return true;
}

export function releaseCompletion(completionId: string) {
  const entry = running.get(completionId);

  if (!entry) {
    return;
  }

  running.delete(completionId);
  byConversation.delete(entry.conversationId);
}

export function cancelCompletion(completionId: string) {
  const entry = running.get(completionId);

  if (!entry) {
    return false;
  }

  entry.controller.abort();
  releaseCompletion(completionId);

  return true;
}

/** Used before a conversation is deleted out from under its own turn. */
export function cancelConversationCompletion(conversationId: string) {
  const completionId = byConversation.get(conversationId);

  return completionId === undefined ? false : cancelCompletion(completionId);
}
