import { randomUUID } from "node:crypto";

const TRACE_HEADER = "x-member-profile-trace-id";
const REQUEST_ID_HEADER = "x-request-id";

export function resolveMemberProfileTraceId(req?: Request): string {
  const incoming =
    req?.headers.get(TRACE_HEADER) ?? req?.headers.get(REQUEST_ID_HEADER) ?? undefined;
  if (incoming !== undefined) {
    const trimmed = incoming.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return randomUUID();
}

export function memberProfileTraceResponseHeaders(traceId: string): Record<string, string> {
  return { [TRACE_HEADER]: traceId };
}
