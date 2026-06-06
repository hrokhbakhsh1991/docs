import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

function readHeader(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const raw = headers[name.toLowerCase()] ?? headers[name];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }
  return undefined;
}

/**
 * Resolves trace / correlation id from ingress headers or generates one when absent.
 * Priority: x-trace-id → x-correlation-id → x-request-id → randomUUID().
 */
export function resolveTraceIdFromHeaders(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>
): string {
  return (
    readHeader(headers, "x-trace-id") ??
    readHeader(headers, "x-correlation-id") ??
    readHeader(headers, "x-request-id") ??
    randomUUID()
  );
}
