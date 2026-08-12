const START_COMMAND = 'cd inference && just serve';

function collectCauses(error: unknown) {
  const parts: string[] = [];
  let current: unknown = error;

  for (
    let depth = 0;
    depth < 4 && current !== null && current !== undefined;
  ) {
    if (typeof current === 'object') {
      const candidate = current as { code?: unknown; message?: unknown };

      if (typeof candidate.code === 'string') {
        parts.push(candidate.code);
      }

      if (typeof candidate.message === 'string') {
        parts.push(candidate.message);
      }

      current = (current as { cause?: unknown }).cause;
      depth += 1;
      continue;
    }

    parts.push(String(current));
    break;
  }

  return parts.join(' ');
}

/**
 * Bun, undici and Node each report a refused connection differently, so the
 * whole cause chain is matched rather than a single `code`.
 */
function isUnreachable(error: unknown) {
  return /ECONNREFUSED|ConnectionRefused|ENOTFOUND|EHOSTUNREACH|Unable to connect/i.test(
    collectCauses(error),
  );
}

export function describeInferenceFailure(error: unknown, endpoint: string) {
  if (isUnreachable(error)) {
    return `Cannot reach the inference server at ${endpoint}. Start it with \`${START_COMMAND}\`.`;
  }

  const detail = error instanceof Error ? error.message : String(error);

  return `The request to the inference server at ${endpoint} failed: ${detail}`;
}

export function describeInferenceStatus(
  status: number,
  detail: string,
  endpoint: string,
) {
  const trimmed = detail.trim();

  return trimmed
    ? `The inference server at ${endpoint} returned ${status}: ${trimmed}`
    : `The inference server at ${endpoint} returned ${status}.`;
}
