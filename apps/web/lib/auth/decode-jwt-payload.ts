/** Minimal JWT payload decode for hydration (no signature verification). */

export type SessionJwtClaims = {
  sub?: string;
  tenant_id?: string;
  role?: string;
  email?: string;
};

export function decodeJwtPayload(token: string): SessionJwtClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) {
      return null;
    }
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    if (typeof atob !== "function") {
      return null;
    }
    const json = atob(b64);
    return JSON.parse(json) as SessionJwtClaims;
  } catch {
    return null;
  }
}
