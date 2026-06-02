/** Minimal JWT payload decode for hydration (no signature verification). */

export type SessionJwtClaims = {
  sub?: string;
  tenant_id?: string;
  role?: string;
  email?: string;
  /** Expiry timestamp (seconds since epoch). Used to detect stale tokens without a backend round-trip. */
  exp?: number;
  /** Issued-at timestamp (seconds since epoch). */
  iat?: number;
};

export function decodeJwtPayload(token: string): SessionJwtClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) {
      return null;
    }
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(b64, "base64").toString("utf8");
    } else if (typeof atob === "function") {
      json = atob(b64);
    } else {
      return null;
    }
    return JSON.parse(json) as SessionJwtClaims;
  } catch {
    return null;
  }
}

/**
 * Returns true when the JWT `exp` claim is present and already in the past.
 * Uses a 30-second clock skew buffer to guard against minor drift.
 */
export function isJwtExpired(claims: SessionJwtClaims | null, clockSkewSeconds = 30): boolean {
  if (!claims || typeof claims.exp !== "number") {
    return false; // no exp → treat as non-expiring (dev tokens)
  }
  return Date.now() / 1000 > claims.exp - clockSkewSeconds;
}
