export const DEFAULT_TRANSIENT_HTTP_STATUSES = [502, 503, 504] as const;

export type FetchWithTransientRetryOptions = {
  readonly retryDelayMs?: number;
  readonly transientStatuses?: readonly number[];
};

/** One retry for short-lived gateway / pool saturation bursts during client hydrate. */
export async function fetchWithTransientRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchWithTransientRetryOptions
): Promise<Response> {
  const transientStatuses = new Set(
    options?.transientStatuses ?? DEFAULT_TRANSIENT_HTTP_STATUSES
  );
  const retryDelayMs = options?.retryDelayMs ?? 300;
  const first = await fetch(input, init);
  if (!transientStatuses.has(first.status)) {
    return first;
  }
  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  return fetch(input, init);
}
