import { LoggerService } from "@/lib/logging/logger.service";

type BffLogContext = Record<string, string | number | boolean | undefined>;

/** Structured BFF info events (non-fatal; always visible in production via stderr). */
export function logBffEvent(event: string, context: BffLogContext): void {
  LoggerService.info(`[bff] ${event}`, { layer: "bff", ...context });
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
  LoggerService.error(message, { layer: "bff", event: "bff_error", ...context });
}
