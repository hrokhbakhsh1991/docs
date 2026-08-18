import { cookies, headers } from "next/headers";

import {
  readSessionTokenFromCookieHeader as parseSessionTokenFromCookieHeader,
  validateSessionTokenAsync,
} from "@app-tour/session-client";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";

export type PublicCatalogSession = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: "owner" | "admin" | "member" | "viewer";
  readonly workspaceId?: string;
};

function normalizeCatalogRole(
  role: string | undefined
): PublicCatalogSession["role"] | null {
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

/** Raw Cookie header: `cookies()` first, then request `Cookie` (PCMS-SEC-03). */
export async function readMemberCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const fromStore = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (fromStore.length > 0) {
    return fromStore;
  }

  const headerStore = await headers();
  return headerStore.get("cookie") ?? "";
}

/** Same token source for session decode and BFF `Authorization` (PCMS-SEC-03). */
export async function readMemberSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const fromStore = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (fromStore !== undefined && fromStore.length > 0) {
    return fromStore;
  }

  const headerStore = await headers();
  const raw = headerStore.get("cookie") ?? "";
  return parseSessionTokenFromCookieHeader(raw, SESSION_TOKEN_COOKIE);
}

/** M17 public catalog session — any ACTIVE membership role (not operator-owner-only). */
export async function readPublicCatalogSessionFromCookies(): Promise<PublicCatalogSession | null> {
  const token = await readMemberSessionToken();
  const validation = await validateSessionTokenAsync(token);
  if (validation.status !== "valid") {
    return null;
  }

  const role = normalizeCatalogRole(validation.role);
  if (role === null) {
    return null;
  }

  return {
    userId: validation.userId,
    tenantId: validation.tenantId,
    role,
    ...(validation.workspaceId !== undefined ? { workspaceId: validation.workspaceId } : {}),
  };
}
