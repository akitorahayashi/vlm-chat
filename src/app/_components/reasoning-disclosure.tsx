import { useEffect, useState } from 'react';

export function ReasoningDisclosure({
  text,
  expanded,
}: {
  text: string;
  expanded: boolean;
}) {
  const [open, setOpen] = useState(expanded);

  useEffect(() => setOpen(expanded), [expanded]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="border-l-2 border-zinc-300 pl-3 dark:border-zinc-700"
    >
      <summary className="cursor-pointer font-mono text-xs uppercase text-zinc-500">
        Reasoning
      </summary>
      <p className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-zinc-500">
        {text}
      </p>
    </details>
  );
}
