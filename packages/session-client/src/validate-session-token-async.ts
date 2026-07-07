import { decodeJwtPayload } from "./decode-jwt-payload";
import { verifySessionJwtSignature } from "./verify-session-jwt-signature";
import {
  validateSessionToken,
  type SessionTokenValidation,
} from "./validate-session-token";

function readSessionVersion(claims: ReturnType<typeof decodeJwtPayload>): number | undefined {
  const raw = claims?.sess_ver;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export type SessionTokenAsyncValidation =
  | (Extract<SessionTokenValidation, { status: "valid" }> & {
      readonly sessionVersion?: number;
    })
  | Exclude<SessionTokenValidation, { status: "valid" }>
  | { status: "invalid_signature" };

/**
 * Decode + optional RS256 verify when AUTH_JWT_* configured (PCMS-SEC-02).
 * Sync {@link validateSessionToken} remains decode-only for legacy callers.
 */
export async function validateSessionTokenAsync(
  raw: string | undefined | null
): Promise<SessionTokenAsyncValidation> {
  const base = validateSessionToken(raw);
  if (base.status !== "valid") {
    return base;
  }

  const token = typeof raw === "string" ? raw.trim() : "";
  const signatureOk = await verifySessionJwtSignature(token);
  if (!signatureOk) {
    return { status: "invalid_signature" };
  }

  const sessionVersion = readSessionVersion(decodeJwtPayload(token));
  return {
    ...base,
    ...(sessionVersion !== undefined ? { sessionVersion } : {}),
  };
}
