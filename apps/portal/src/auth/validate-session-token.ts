import { decodeJwtPayload, isJwtExpired } from "@/auth/decode-jwt-payload";

export type SessionTokenValidationStatus = "valid" | "missing" | "expired" | "invalid_claims";

export type SessionTokenValidation =
  | { status: "valid"; userId: string; tenantId: string; role?: string }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "invalid_claims" };

export function validateSessionToken(raw: string | undefined | null): SessionTokenValidation {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (token.length === 0) {
    return { status: "missing" };
  }

  const claims = decodeJwtPayload(token);
  if (isJwtExpired(claims)) {
    return { status: "expired" };
  }

  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
  if (userId.length === 0 || tenantId.length === 0) {
    return { status: "invalid_claims" };
  }

  const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
  return { status: "valid", userId, tenantId, role };
}
