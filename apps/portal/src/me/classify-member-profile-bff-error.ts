/**
 * PCMS-SEC-03 — map member BFF failures to dead-session vs outage.
 * Shared by profile self-fetch and entitlements upstream.
 * HTTP 401/403/404 and identity revoke/unauth codes = unauthenticated.
 * 5xx / network / BACKEND_UNREACHABLE = unavailable (keep cookie).
 */
const DEAD_SESSION_CODES = new Set<string>([
  "AUTH_UNAUTHENTICATED",
  "AUTH_INVALID_TOKEN",
  "AUTH_TOKEN_REVOKED",
  "AUTH_TENANT_HOST_MISMATCH",
  "UNAUTHORIZED_INVALID_BEARER_TOKEN",
  "IDENTITY_REQUIRED",
  "UNAUTHORIZED_HEADER_AUTH_FORBIDDEN_OUTSIDE_TEST",
]);

export type MemberProfileBffFailureKind = "unauthenticated" | "unavailable";

/** Profile `{ error: { code } }` and API `{ code }` / `{ error: string }` shapes. */
export function readMemberBffErrorCode(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return record.code.trim();
  }
  const error = record.error;
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  if (error !== null && typeof error === "object") {
    const nested = (error as { readonly code?: unknown }).code;
    if (typeof nested === "string" && nested.trim().length > 0) {
      return nested.trim();
    }
  }
  return undefined;
}

export function classifyMemberProfileBffFailure(
  status: number,
  code?: string
): MemberProfileBffFailureKind {
  const normalized = code?.trim() ?? "";
  if (DEAD_SESSION_CODES.has(normalized)) {
    return "unauthenticated";
  }
  if (status === 401 || status === 403 || status === 404) {
    return "unauthenticated";
  }
  return "unavailable";
}
