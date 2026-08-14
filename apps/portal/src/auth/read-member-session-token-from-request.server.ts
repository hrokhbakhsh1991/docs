import { cookies, headers } from "next/headers";

import { readSessionTokenFromCookieHeader } from "@app-tour/session-client";

import { SESSION_TOKEN_COOKIE } from "./build-session-cookie";

export function resolveMemberSessionTokenFromSources(input: {
  readonly cookieStoreValue?: string | null;
  readonly rawCookieHeader?: string | null;
}): string | undefined {
  const fromStore = input.cookieStoreValue?.trim();
  if (fromStore !== undefined && fromStore.length > 0) {
    return fromStore;
  }

  return readSessionTokenFromCookieHeader(
    input.rawCookieHeader ?? "",
    SESSION_TOKEN_COOKIE
  );
}

export async function readMemberSessionTokenFromRequest(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolveMemberSessionTokenFromSources({
    cookieStoreValue: cookieStore.get(SESSION_TOKEN_COOKIE)?.value,
    rawCookieHeader: headerStore.get("cookie"),
  });
}
