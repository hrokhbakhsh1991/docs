const DEFAULT_MAX_CONCURRENT_OPERATOR_API_FETCHES = 2;
const OPERATOR_API_FETCH_RETRYABLE_READ_CODES = new Set([
  "TENANT_DB_BUDGET_EXCEEDED",
  "DB_POOL_SATURATED",
]);
const DEFAULT_RETRYABLE_READ_BACKOFF_MS = 120;
const MAX_RETRYABLE_READ_BACKOFF_MS = 2_000;
const DEFAULT_OPERATOR_API_READ_TIMEOUT_MS = 20_000;

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

function resolveOperatorApiFetchMethod(init?: RequestInit): string {
  return (init?.method ?? "GET").trim().toUpperCase();
}

function isRetryableOperatorApiRead(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export function resolveOperatorApiReadTimeoutMs(): number {
  const raw = process.env.OPERATOR_BFF_READ_TIMEOUT_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_OPERATOR_API_READ_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1
    ? parsed
    : DEFAULT_OPERATOR_API_READ_TIMEOUT_MS;
}

function buildTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function withDefaultOperatorApiReadTimeout(init: RequestInit | undefined, method: string): RequestInit | undefined {
  if (!isRetryableOperatorApiRead(method) || init?.signal !== undefined) {
    return init;
  }
  return {
    ...init,
    signal: buildTimeoutSignal(resolveOperatorApiReadTimeoutMs()),
  };
}

function parseRetryAfterMs(response: Response): number {
  const raw = response.headers.get("Retry-After")?.trim() ?? "";
  if (raw.length === 0) {
    return DEFAULT_RETRYABLE_READ_BACKOFF_MS;
  }
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_RETRYABLE_READ_BACKOFF_MS;
  }
  return Math.min(seconds * 1_000, MAX_RETRYABLE_READ_BACKOFF_MS);
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readRetryableOperatorApiCode(response: Response): Promise<string | null> {
  if (response.status !== 503) {
    return null;
  }
  const clone = response.clone();
  const body = (await clone.json().catch(() => null)) as { readonly code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  return OPERATOR_API_FETCH_RETRYABLE_READ_CODES.has(code) ? code : null;
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
    const method = resolveOperatorApiFetchMethod(init);
    const response = await fetchImpl(input, withDefaultOperatorApiReadTimeout(init, method));
    if (!isRetryableOperatorApiRead(method)) {
      return response;
    }
    const retryableCode = await readRetryableOperatorApiCode(response);
    if (retryableCode === null) {
      return response;
    }
    await delay(parseRetryAfterMs(response));
    return await fetchImpl(input, withDefaultOperatorApiReadTimeout(init, method));
  } finally {
    releaseOperatorApiFetchSlot();
  }
}
