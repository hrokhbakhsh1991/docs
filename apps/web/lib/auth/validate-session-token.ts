import { decodeJwtPayload, isJwtExpired } from "./decode-jwt-payload";

/** Forwarded from middleware → RSC for client audit bridge (`data-auth-audit`). */
export const AUTH_AUDIT_REQUEST_HEADER = "x-auth-audit";

export type SessionTokenValidationStatus = "valid" | "missing" | "expired" | "invalid_claims";

export type SessionTokenValidation =
  | { status: "valid"; userId: string; tenantId: string; role?: string }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "invalid_claims" };

/**
 * Shared session JWT gate — used by middleware, BFF `/api/auth/session`, and client hydrate checks.
 * Does not verify signature; matches BFF hydration rules (`sub`, `tenant_id`, optional `exp`).
 */
export function validateSessionToken(raw: string | undefined | null): SessionTokenValidation {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    return { status: "missing" };
  }

  const claims = decodeJwtPayload(token);
  if (isJwtExpired(claims)) {
    return { status: "expired" };
  }

  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
  if (!userId || !tenantId) {
    return { status: "invalid_claims" };
  }

  const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
  return { status: "valid", userId, tenantId, role };
}

/** Human-readable audit line for middleware / AuthProvider console output. */
export function formatAuthAuditLabel(validation: SessionTokenValidation): string {
  switch (validation.status) {
    case "valid":
      return "Token found";
    case "missing":
      return "Token missing";
    case "expired":
      return "Token missing";
    case "invalid_claims":
      return "Token missing";
    default:
      return "Token missing";
  }
}

export function authAuditHeaderValue(validation: SessionTokenValidation): string {
  return validation.status;
}
