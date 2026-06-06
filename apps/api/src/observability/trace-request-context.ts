import { AsyncLocalStorage } from "node:async_hooks";

export type TraceRequestStore = {
  readonly traceId: string;
};

const traceRequestStorage = new AsyncLocalStorage<TraceRequestStore>();

/**
 * Runs work with the active trace id in AsyncLocalStorage.
 * Compose with {@link runWithTenantContext} by nesting at the HTTP boundary.
 */
export function runWithTraceContext<T>(traceId: string, run: () => Promise<T>): Promise<T> {
  const normalized = traceId.trim();
  if (normalized.length === 0) {
    throw new Error("TRACE_CONTEXT_TRACE_ID_REQUIRED");
  }
  return traceRequestStorage.run({ traceId: normalized }, run);
}

/** Active trace id from ALS — undefined outside {@link runWithTraceContext}. */
export function getActiveTraceId(): string | undefined {
  return traceRequestStorage.getStore()?.traceId;
}

export function requireActiveTraceId(): string {
  const traceId = getActiveTraceId();
  if (traceId === undefined) {
    throw new Error("TRACE_CONTEXT_NOT_BOUND");
  }
  return traceId;
}
