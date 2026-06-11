import type { IncomingMessage } from "node:http";

export function readSessionCookieToken(req: IncomingMessage): string | null {
  const raw = req.headers.cookie;
  if (raw === undefined || raw.length === 0) {
    return null;
  }
  const parts = raw.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith("session=")) {
      const value = part.slice("session=".length).trim();
      return value.length > 0 ? decodeURIComponent(value) : null;
    }
  }
  return null;
}
