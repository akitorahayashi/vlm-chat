import { ReasoningDisclosure } from './reasoning-disclosure';

export type TurnView = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning: string;
  status: string;
  errorMessage: string | null;
  modelId: string | null;
  images: string[];
};

function describeOutcome(turn: TurnView, streaming: boolean) {
  if (turn.status === 'failed') {
    return turn.errorMessage ?? 'This turn failed.';
  }

  if (turn.status === 'aborted') {
    return 'Interrupted.';
  }

  // Nothing is streaming into this turn any more, yet it was never closed:
  // either the server stopped between the two writes, or the page was loaded
  // in the moment between them.
  if (turn.status === 'streaming' && !streaming) {
    return 'This turn did not finish.';
  }

  // The whole answer landing in the reasoning channel is what a thinking
  // template looks like when the model never closes the block. Saying so beats
  // rendering an empty bubble.
  if (
    turn.status === 'complete' &&
    turn.content.length === 0 &&
    turn.reasoning.length > 0
  ) {
    return 'This model returned reasoning but no answer.';
  }

  return null;
}

export function Turn({
  turn,
  streaming,
}: {
  turn: TurnView;
  streaming: boolean;
}) {
  const outcome = describeOutcome(turn, streaming);
  const isUser = turn.role === 'user';

  return (
    <article
      data-role={turn.role}
      data-status={turn.status}
      className="flex flex-col gap-3 border-b border-zinc-200 py-6 dark:border-zinc-800"
    >
      <p className="font-mono text-xs uppercase text-zinc-500">
        {isUser ? 'You' : (turn.modelId ?? 'Assistant')}
      </p>

      {turn.images.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {turn.images.map((source) => (
            <li key={source}>
              {/** biome-ignore lint/performance/noImgElement: attachments are
               * same-origin bytes or data URLs, both outside next/image's
               * optimizer and both required by the app's img-src policy. */}
              <img
                src={source}
                alt="Attachment"
                className="max-h-48 border border-zinc-300 dark:border-zinc-700"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {turn.reasoning.length > 0 ? (
        <ReasoningDisclosure
          text={turn.reasoning}
          expanded={streaming && turn.content.length === 0}
        />
      ) : null}

      {turn.content.length > 0 ? (
        <p className="whitespace-pre-wrap text-base leading-7">
          {turn.content}
        </p>
      ) : null}

      {streaming && turn.content.length === 0 && turn.reasoning.length === 0 ? (
        <p className="font-mono text-xs text-zinc-500">
          Waiting for the model&hellip; a model that is not loaded yet is read
          from disk first.
        </p>
      ) : null}

      {outcome ? (
        <p
          data-outcome={turn.status}
          className="font-mono text-xs text-amber-700 dark:text-amber-400"
        >
          {outcome}
        </p>
      ) : null}
    </article>
  );
}
