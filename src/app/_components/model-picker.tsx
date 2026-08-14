export function ModelPicker({
  models,
  value,
  disabled,
  onChange,
}: {
  models: string[] | null;
  value: string | null;
  disabled: boolean;
  onChange: (modelId: string) => void;
}) {
  if (models === null) {
    return (
      <p className="min-w-0 flex-1 font-mono text-xs text-zinc-500">
        Loading models&hellip;
      </p>
    );
  }

  // A conversation can name a model that has since left the HuggingFace cache.
  // Saying so beats quietly answering with a different model than the
  // transcript was produced by.
  const missing = value !== null && !models.includes(value);

  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 font-mono text-xs text-zinc-500">
      <span className="shrink-0 uppercase">Model</span>
      <select
        aria-label="Model"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 truncate border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {missing ? (
          <option value={value}>{value} (not installed)</option>
        ) : null}
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
}
