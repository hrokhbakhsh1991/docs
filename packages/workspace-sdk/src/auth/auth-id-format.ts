import type { AuthContextErrorCode } from "./auth-context-errors";
import { InvalidTenantAuthContextError } from "./auth-context-errors";

/** Allowed id charset for tenant/workspace/plugin identifiers (no path traversal, no Unicode homoglyph surface). */
export const AUTH_SCOPE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/i;

export function assertAuthScopeId(
  field: string,
  value: string,
  code: AuthContextErrorCode = "AUTH_SCOPE_ID_INVALID",
): void {
  if (!AUTH_SCOPE_ID_PATTERN.test(value)) {
    throw new InvalidTenantAuthContextError(
      code,
      `${field} must match ${AUTH_SCOPE_ID_PATTERN.source} (1–128 chars, alphanumeric/start)`,
    );
  }
}
