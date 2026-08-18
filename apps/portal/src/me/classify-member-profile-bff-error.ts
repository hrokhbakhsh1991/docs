/**
 * PCMS-SEC-03 — map profile BFF failures to dead-session vs outage.
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
