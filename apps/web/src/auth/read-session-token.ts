import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { readSessionTokenFromRequestHeaders } from "@app-tour/session-client";

export function readSessionTokenFromRequest(req: Request): string | null {
  return readSessionTokenFromRequestHeaders(req.headers, SESSION_TOKEN_COOKIE) ?? null;
}
