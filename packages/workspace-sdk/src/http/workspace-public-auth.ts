/**
 * Shared public catalog auth helpers (DG-1.7).
 * Product packages keep thin wrappers / stable export aliases.
 */

import type { IncomingMessage } from "node:http";

import type { ActorRole, TenantAuthContext } from "../auth";

export const WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID =
  "00000000-0000-4000-0000-000000000001" as const;

export const WORKSPACE_PUBLIC_AUTH_MISSING_TENANT =
  "UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT" as const;

export const WORKSPACE_PUBLIC_AUTH_MISSING_USER_ID =
  "UNAUTHORIZED_MISSING_USER_ID" as const;

export const WORKSPACE_PUBLIC_AUTH_REGISTERED_USER_REQUIRED =
  "UNAUTHORIZED_REGISTERED_USER_REQUIRED" as const;

export type WorkspacePublicAuthHeaderInput = {
  readonly tenantId?: string;
  readonly authenticatedTenantId?: string;
  readonly userId?: string;
  readonly role?: string;
  readonly workspaceId?: string;
};

/** Coalesce IncomingMessage / multi-value headers to a non-empty trimmed string. */
export function readWorkspaceHttpHeaderValue(
  raw: string | string[] | undefined,
): string | undefined {
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve tenant auth for public catalog / registration intake.
 * Tenant from `tenantId` or `authenticatedTenantId`; anonymous actors get the guest user id.
 */
export function resolveWorkspacePublicAuthFromHeaders(
  headers: WorkspacePublicAuthHeaderInput,
): TenantAuthContext {
  const tenantId = (headers.tenantId ?? headers.authenticatedTenantId)?.trim();
  if (!tenantId) {
    throw new Error(WORKSPACE_PUBLIC_AUTH_MISSING_TENANT);
  }

  const role = (headers.role?.trim() as ActorRole | undefined) ?? "none";
  const userId = headers.userId?.trim() ?? WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID;
  if (role !== "none" && userId.length === 0) {
    throw new Error(WORKSPACE_PUBLIC_AUTH_MISSING_USER_ID);
  }

  return {
    tenantId,
    userId,
    role,
    status: "ACTIVE",
    workspaceId: headers.workspaceId,
  };
}

/** Read standard `x-tenant-id` / actor headers from an HTTP request. */
export function resolveWorkspacePublicAuthFromRequest(
  req: IncomingMessage,
): TenantAuthContext {
  return resolveWorkspacePublicAuthFromHeaders({
    tenantId: readWorkspaceHttpHeaderValue(req.headers["x-tenant-id"]),
    authenticatedTenantId: readWorkspaceHttpHeaderValue(
      req.headers["x-authenticated-tenant-id"],
    ),
    userId: readWorkspaceHttpHeaderValue(req.headers["x-user-id"]),
    role: readWorkspaceHttpHeaderValue(req.headers["x-actor-role"]),
    workspaceId: readWorkspaceHttpHeaderValue(req.headers["x-workspace-id"]),
  });
}

/** Reject the shared public guest actor id (registered-user routes). */
export function assertWorkspaceRegisteredUserOrThrow(
  auth: Pick<TenantAuthContext, "userId">,
  options?: {
    readonly guestUserId?: string;
    readonly createError?: () => Error;
  },
): void {
  const guestUserId = options?.guestUserId ?? WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID;
  if (auth.userId === guestUserId) {
    throw (
      options?.createError?.() ??
      new Error(WORKSPACE_PUBLIC_AUTH_REGISTERED_USER_REQUIRED)
    );
  }
}
