import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { validateSessionTokenAsync } from "@app-tour/session-client";

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

function readSessionTokenFromCookieHeader(raw: string): string | undefined {
  const match = raw.match(/(?:^|;\s*)atour_mb_session=([^;]*)/);
  if (match?.[1] === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

async function readSessionTokenFromRequest(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const fromStore = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (fromStore !== undefined && fromStore.length > 0) {
    return fromStore;
  }

  const headerStore = await headers();
  const raw = headerStore.get("cookie") ?? "";
  return readSessionTokenFromCookieHeader(raw);
}

/** M17 public catalog session — any ACTIVE membership role (not operator-owner-only). */
export async function readPublicCatalogSessionFromCookies(): Promise<PublicCatalogSession | null> {
  const token = await readSessionTokenFromRequest();
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
