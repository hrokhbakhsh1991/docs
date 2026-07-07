import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";

export type SessionProxyContext = {
  readonly token: string;
  readonly host: string;
};

/**
 * Session token + host header for server-side BFF fetches to @apps/api.
 * Host is normalized to hostname (no port) for upstream routing.
 */
export async function readSessionProxyContext(): Promise<SessionProxyContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  return { token, host: host.split(":")[0] ?? "localhost" };
}
