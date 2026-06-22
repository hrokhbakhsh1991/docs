import { cookies } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { validateSessionToken } from "@/auth/validate-session-token";

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

/** M17 public catalog session — any ACTIVE membership role (not operator-owner-only). */
export async function readPublicCatalogSessionFromCookies(): Promise<PublicCatalogSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value;
  const validation = validateSessionToken(token);
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
