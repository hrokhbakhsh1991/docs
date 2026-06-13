import { decodeJwtPayload, isJwtExpired } from "@/auth/decode-jwt-payload";
import { verifySessionJwtSignature } from "@/auth/verify-session-jwt-signature";

export type SessionTokenValidationStatus = "valid" | "missing" | "expired" | "invalid_claims";

export type SessionTokenValidation =
  | {
      status: "valid";
      userId: string;
      tenantId: string;
      workspaceId?: string;
      role?: string;
    }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "invalid_claims" };

export async function validateSessionToken(
  raw: string | undefined | null
): Promise<SessionTokenValidation> {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (token.length === 0) {
    return { status: "missing" };
  }

  if (!(await verifySessionJwtSignature(token))) {
    return { status: "invalid_claims" };
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
  const workspaceId =
    typeof claims?.workspace_id === "string" ? claims.workspace_id.trim() : undefined;
  return {
    status: "valid",
    userId,
    tenantId,
    ...(workspaceId !== undefined && workspaceId.length > 0 ? { workspaceId } : {}),
    role,
  };
}
