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
