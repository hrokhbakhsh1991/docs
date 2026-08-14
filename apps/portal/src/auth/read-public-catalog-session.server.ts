import {
  validateSessionTokenAsync,
} from "@app-tour/session-client";

import { readMemberSessionTokenFromRequest } from "@/auth/read-member-session-token-from-request.server";

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
  const token = await readMemberSessionTokenFromRequest();
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
