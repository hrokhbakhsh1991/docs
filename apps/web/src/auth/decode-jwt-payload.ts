/** Minimal JWT payload decode for hydration (no signature verification). */

export type SessionJwtClaims = {
  sub?: string;
  tenant_id?: string;
  workspace_id?: string;
  role?: string;
  exp?: number;
  iat?: number;
};

export function decodeJwtPayload(token: string): SessionJwtClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) {
      return null;
    }
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as SessionJwtClaims;
  } catch {
    return null;
  }
}

export function isJwtExpired(claims: SessionJwtClaims | null, clockSkewSeconds = 30): boolean {
  if (!claims || typeof claims.exp !== "number") {
    return false;
  }
  return Date.now() / 1000 > claims.exp - clockSkewSeconds;
}
