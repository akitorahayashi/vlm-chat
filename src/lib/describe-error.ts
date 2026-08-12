export function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
