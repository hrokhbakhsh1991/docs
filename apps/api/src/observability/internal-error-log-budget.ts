/** LOG-BP-04 / DEC-128 — cap http.error.internal logs during 500 storms. */

let windowStartMs = 0;
let loggedInWindow = 0;
let suppressedInWindow = 0;
let flushSuppressedSummary: (() => void) | undefined;

export function resolveInternalErrorLogBurstMax(): number {
  const parsed = Number.parseInt(process.env.HTTP_INTERNAL_ERROR_LOG_BURST ?? "32", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 32;
}

export function bindInternalErrorLogSuppressedSummary(fn: () => void): void {
  flushSuppressedSummary = fn;
}

function rollWindowIfNeeded(nowMs: number): void {
  if (windowStartMs === 0) {
    windowStartMs = nowMs;
    return;
  }
  if (nowMs - windowStartMs < 1000) {
    return;
  }
  if (suppressedInWindow > 0) {
    flushSuppressedSummary?.();
  }
  windowStartMs = nowMs;
  loggedInWindow = 0;
  suppressedInWindow = 0;
}

/** Returns true when a full structured internal-error log line should be emitted. */
export function acquireInternalErrorLogSlot(nowMs = performance.now()): boolean {
  rollWindowIfNeeded(nowMs);
  const max = resolveInternalErrorLogBurstMax();
  if (loggedInWindow < max) {
    loggedInWindow += 1;
    return true;
  }
  suppressedInWindow += 1;
  return false;
}

export function readSuppressedInternalErrorCount(): number {
  return suppressedInWindow;
}

/** Test-only — reset burst window state. */
export function resetInternalErrorLogBudgetForTests(): void {
  windowStartMs = 0;
  loggedInWindow = 0;
  suppressedInWindow = 0;
}
