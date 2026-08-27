const DEFAULT_MAX_CONCURRENT_OPERATOR_API_FETCHES = 2;

type OperatorApiFetchLimiterState = {
  activeFetches: number;
  waitQueue: Array<() => void>;
};

const OPERATOR_API_FETCH_LIMITER_STATE = Symbol.for(
  "app-tour.operatorApiFetchLimiterState"
);

function getLimiterState(): OperatorApiFetchLimiterState {
  const globalState = globalThis as typeof globalThis & {
    [OPERATOR_API_FETCH_LIMITER_STATE]?: OperatorApiFetchLimiterState;
  };
  globalState[OPERATOR_API_FETCH_LIMITER_STATE] ??= {
    activeFetches: 0,
    waitQueue: [],
  };
  return globalState[OPERATOR_API_FETCH_LIMITER_STATE];
}

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
  const state = getLimiterState();
  const maxConcurrent = resolveMaxConcurrentOperatorApiFetches();
  if (state.activeFetches < maxConcurrent && state.waitQueue.length === 0) {
    state.activeFetches += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    state.waitQueue.push(resolve);
  });
}

function releaseOperatorApiFetchSlot(): void {
  const state = getLimiterState();
  const next = state.waitQueue.shift();
  if (next !== undefined) {
    next();
    return;
  }
  state.activeFetches = Math.max(0, state.activeFetches - 1);
}

export function getActiveOperatorApiFetchCountForTests(): number {
  return getLimiterState().activeFetches;
}

export function getQueuedOperatorApiFetchCountForTests(): number {
  return getLimiterState().waitQueue.length;
}

export function resetOperatorApiFetchLimiterForTests(): void {
  const state = getLimiterState();
  state.activeFetches = 0;
  state.waitQueue.length = 0;
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
