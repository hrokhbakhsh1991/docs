import type { IncomingMessage } from "node:http";
import type { ActorRole, TenantAuthContext } from "@app-tour/workspace-sdk";

const PUBLIC_CATALOG_GUEST_USER_ID = "00000000-0000-4000-0000-000000000001";
const UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT = "UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT";
const UNAUTHORIZED_MISSING_USER_ID = "UNAUTHORIZED_MISSING_USER_ID";

function headerValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Public denali catalog — tenant from `x-tenant-id` only.
 * Does not require workspace binding (ROLE `none` anonymous actor).
 */
export function resolveDenaliPublicAuth(req: IncomingMessage): TenantAuthContext {
  const tenantId = (
    headerValue(req.headers["x-tenant-id"]) ?? headerValue(req.headers["x-authenticated-tenant-id"])
  )?.trim();
  if (!tenantId) {
    throw new Error(UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT);
  }

  const role = (headerValue(req.headers["x-actor-role"]) as ActorRole | undefined) ?? "none";
  const userId = headerValue(req.headers["x-user-id"]) ?? PUBLIC_CATALOG_GUEST_USER_ID;
  if (role !== "none" && userId.length === 0) {
    throw new Error(UNAUTHORIZED_MISSING_USER_ID);
  }

  return {
    tenantId,
    userId,
    role,
    status: "ACTIVE",
    workspaceId: headerValue(req.headers["x-workspace-id"]),
  };
}
