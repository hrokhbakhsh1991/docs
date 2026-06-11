import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (cookieHeader === null || cookieHeader.length === 0) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      const rawValue = rest.join("=").trim();
      if (rawValue.length === 0) {
        return null;
      }
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return null;
}

export function readSessionTokenFromRequest(req: Request): string | null {
  const authorization = req.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }
  return readCookieValue(req.headers.get("cookie"), SESSION_TOKEN_COOKIE);
}
