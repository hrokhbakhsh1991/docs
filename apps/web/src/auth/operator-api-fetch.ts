const DEFAULT_MAX_CONCURRENT_OPERATOR_API_FETCHES = 3;

let activeFetches = 0;
const waitQueue: Array<() => void> = [];

export function resolveMaxConcurrentOperatorApiFetches(): number {
  const raw = process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_MAX_CONCURRENT_OPERATOR_API_FETCHES;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1
    ? parsed
    : DEFAULT_MAX_CONCURRENT_OPERATOR_API_FETCHES;
}

async function acquireOperatorApiFetchSlot(): Promise<void> {
  const maxConcurrent = resolveMaxConcurrentOperatorApiFetches();
  if (activeFetches < maxConcurrent && waitQueue.length === 0) {
    activeFetches += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
}

function releaseOperatorApiFetchSlot(): void {
  const next = waitQueue.shift();
  if (next !== undefined) {
    next();
    return;
  }
  activeFetches = Math.max(0, activeFetches - 1);
}

export function getActiveOperatorApiFetchCountForTests(): number {
  return activeFetches;
}

export function getQueuedOperatorApiFetchCountForTests(): number {
  return waitQueue.length;
}

export function resetOperatorApiFetchLimiterForTests(): void {
  activeFetches = 0;
  waitQueue.length = 0;
}

/**
 * Bounded Admin BFF -> API fetch.
 *
 * Staging API uses a fail-fast per-tenant DB semaphore. Keep web fan-out below
 * that budget instead of converting short read bursts into user-visible 503s.
 */
export async function operatorApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  await acquireOperatorApiFetchSlot();
  try {
    return await fetchImpl(input, init);
  } finally {
    releaseOperatorApiFetchSlot();
  }
}
