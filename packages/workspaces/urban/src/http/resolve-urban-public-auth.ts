import type { IncomingMessage } from "node:http";
import type { ActorRole, TenantAuthContext } from "@app-tour/workspace-sdk";

export const PUBLIC_CATALOG_GUEST_USER_ID = "00000000-0000-4000-0000-000000000001";
export const URBAN_PUBLIC_AUTH_MISSING_TENANT = "UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT";
export const URBAN_PUBLIC_AUTH_MISSING_USER_ID = "UNAUTHORIZED_MISSING_USER_ID";

export type UrbanPublicAuthHeaderInput = {
  readonly tenantId?: string;
  readonly authenticatedTenantId?: string;
  readonly userId?: string;
  readonly role?: string;
  readonly workspaceId?: string;
};

/** Shared resolver — apps/api passes `readRequestAuthHeaders` output. */
export function resolveUrbanPublicAuthFromHeaders(
  headers: UrbanPublicAuthHeaderInput
): TenantAuthContext {
  const tenantId = (headers.tenantId ?? headers.authenticatedTenantId)?.trim();
  if (!tenantId) {
    throw new Error(URBAN_PUBLIC_AUTH_MISSING_TENANT);
  }

  const role = (headers.role?.trim() as ActorRole | undefined) ?? "none";
  const userId = headers.userId?.trim() ?? PUBLIC_CATALOG_GUEST_USER_ID;
  if (role !== "none" && userId.length === 0) {
    throw new Error(URBAN_PUBLIC_AUTH_MISSING_USER_ID);
  }

  return {
    tenantId,
    userId,
    role,
    status: "ACTIVE",
    workspaceId: headers.workspaceId,
  };
}

function headerValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Public urban catalog + registration intake — tenant from `x-tenant-id` only.
 */
export function resolveUrbanPublicAuth(req: IncomingMessage): TenantAuthContext {
  return resolveUrbanPublicAuthFromHeaders({
    tenantId: headerValue(req.headers["x-tenant-id"]),
    authenticatedTenantId: headerValue(req.headers["x-authenticated-tenant-id"]),
    userId: headerValue(req.headers["x-user-id"]),
    role: headerValue(req.headers["x-actor-role"]),
    workspaceId: headerValue(req.headers["x-workspace-id"]),
  });
}
