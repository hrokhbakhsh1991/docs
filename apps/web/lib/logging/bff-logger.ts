type BffLogContext = Record<string, string | number | boolean | undefined>;

/** Structured BFF logs (dev: console; production: hook to observability later). */
export function logBffEvent(event: string, context: BffLogContext): void {
  const payload = { event, ...context, layer: "bff" as const };
  if (process.env.NODE_ENV === "production") {
    console.info(JSON.stringify(payload));
  } else {
    console.info("[bff]", payload);
  }
}

/** Phase 15.2 — correlate FE failures with API `requestId` / tenant / role. */
export function logBffError(
  message: string,
  context: BffLogContext & {
    requestId?: string;
    traceparent?: string;
    endpoint?: string;
    tenantSlug?: string;
    tenantId?: string;
    role?: string;
  },
): void {
  logBffEvent("bff_error", { message, ...context });
}
