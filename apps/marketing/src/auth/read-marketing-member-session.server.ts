import { cookies, headers } from "next/headers";

import {
  readSessionTokenFromCookieHeader,
  SESSION_COOKIE_NAMES,
  validateSessionTokenAsync,
} from "@app-tour/session-client";

export type MarketingMemberSession = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: "owner" | "admin" | "member" | "viewer";
};

const SESSION_TOKEN_COOKIE = SESSION_COOKIE_NAMES.member;

function normalizeMemberRole(
  role: string | undefined
): MarketingMemberSession["role"] | null {
  if (
    role === "owner" ||
    role === "admin" ||
    role === "member" ||
    role === "viewer"
  ) {
    return role;
  }
  return null;
}

async function readSessionTokenFromRequest(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const fromStore = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (fromStore !== undefined && fromStore.length > 0) {
    return fromStore;
  }

  const headerStore = await headers();
  const raw = headerStore.get("cookie") ?? "";
  return readSessionTokenFromCookieHeader(raw, SESSION_TOKEN_COOKIE);
}

/** Read-only member session probe for marketing header chrome (PCMS-03 header). */
export async function readMarketingMemberSessionFromCookies(): Promise<MarketingMemberSession | null> {
  const token = await readSessionTokenFromRequest();
  const validation = await validateSessionTokenAsync(token);
  if (validation.status !== "valid") {
    return null;
  }

  const role = normalizeMemberRole(validation.role) ?? "member";

  return {
    userId: validation.userId,
    tenantId: validation.tenantId,
    role,
  };
}

export async function readMarketingMemberSessionToken(): Promise<string | null> {
  const token = await readSessionTokenFromRequest();
  return token !== undefined && token.length > 0 ? token : null;
}
