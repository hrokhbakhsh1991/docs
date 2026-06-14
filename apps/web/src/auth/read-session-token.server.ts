import { cookies } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";

/** Server-only session JWT from the operator web cookie. */
export async function readSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }
  return token;
}
