export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="error-banner"
      className="flex items-start justify-between gap-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      <p className="whitespace-pre-wrap">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 font-mono text-xs uppercase underline"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
