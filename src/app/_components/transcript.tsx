import { Turn, type TurnView } from './turn';

export function Transcript({
  turns,
  streamingId,
}: {
  turns: TurnView[];
  streamingId: string | null;
}) {
  if (turns.length === 0) {
    return (
      <p className="py-16 text-sm text-zinc-500">
        Ask something, or attach an image and ask about it.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {turns.map((turn) => (
        <Turn key={turn.id} turn={turn} streaming={turn.id === streamingId} />
      ))}
    </div>
  );
}
