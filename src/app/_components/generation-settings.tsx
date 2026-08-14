import {
  DEFAULT_GENERATION_SETTINGS,
  GENERATION_LIMITS,
  type GenerationSettings as GenerationSettingsValue,
  generationSettingsSchema,
} from '@/features/completion/generation-settings';

const FIELDS = [
  {
    key: 'temperature',
    label: 'Temperature',
    description: 'Higher values are more varied; 0 is deterministic.',
  },
  {
    key: 'maxTokens',
    label: 'Max output tokens',
    description: 'The maximum length of the generated reply.',
  },
  {
    key: 'topP',
    label: 'Top P',
    description: '1 disables nucleus filtering; lower values are narrower.',
  },
  {
    key: 'repetitionPenalty',
    label: 'Repetition penalty',
    description: '1 disables the penalty; higher values reduce repetition.',
  },
] as const;

export function GenerationSettings({
  value,
  disabled,
  onChange,
}: {
  value: GenerationSettingsValue;
  disabled: boolean;
  onChange: (value: GenerationSettingsValue) => void;
}) {
  const validation = generationSettingsSchema.safeParse(value);
  const issues = validation.success ? [] : validation.error.issues;

  return (
    <details className="relative shrink-0 font-mono text-xs">
      <summary className="cursor-pointer select-none text-zinc-500 uppercase">
        Generation settings
      </summary>

      <div className="absolute top-[calc(100%+0.75rem)] right-0 z-20 w-80 max-w-[calc(100vw-3rem)] space-y-4 border border-zinc-300 bg-zinc-50 p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
        {FIELDS.map((field) => {
          const limits = GENERATION_LIMITS[field.key];
          const error = issues.find((issue) => issue.path[0] === field.key);
          const inputId = `generation-${field.key}`;
          const descriptionId = `${inputId}-description`;
          const errorId = `${inputId}-error`;

          return (
            <div key={field.key} className="space-y-1.5">
              <span className="flex items-center justify-between gap-3 text-zinc-700 dark:text-zinc-300">
                <label htmlFor={inputId}>{field.label}</label>
                <output htmlFor={inputId}>{value[field.key]}</output>
              </span>
              <input
                id={inputId}
                type="range"
                aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
                aria-invalid={error ? true : undefined}
                min={limits.min}
                max={limits.max}
                step={limits.step}
                value={value[field.key]}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [field.key]: Number(event.target.value),
                  })
                }
                className="block w-full accent-emerald-600 disabled:opacity-50"
              />
              <span id={descriptionId} className="block text-zinc-500">
                {field.description}
              </span>
              {error ? (
                <span
                  id={errorId}
                  className="block text-red-600 dark:text-red-400"
                >
                  {error.message}
                </span>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...DEFAULT_GENERATION_SETTINGS })}
          className="border border-zinc-300 px-3 py-1.5 uppercase disabled:opacity-50 dark:border-zinc-700"
        >
          Reset to defaults
        </button>
      </div>
    </details>
  );
}
