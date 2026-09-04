/**
 * Shared React Query helpers for dashboard widgets.
 * Auth failures (401/403) are not retried; empty vs error is the caller's job.
 */

export function queryErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || undefined;
  }
  return undefined;
}

export function joinQueryErrors(errors: unknown[]): string | undefined {
  const unique = [
    ...new Set(errors.map(queryErrorMessage).filter((message): message is string => Boolean(message))),
  ];
  return unique.length > 0 ? unique.join(' · ') : undefined;
}

export function retryUnlessAuthFailure(failureCount: number, error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /\b401\b|\b403\b|NotAuthenticated|PermissionDenied|AccessControlException/.test(message)
  ) {
    return false;
  }
  return failureCount < 3;
}
