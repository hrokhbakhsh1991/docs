import type { IncomingMessage } from "node:http";
import type { ActorRole, TenantAuthContext } from "@app-tour/workspace-sdk";

import { readRequestAuthHeaders } from "../auth/read-request-headers";
import {
  UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT,
  UNAUTHORIZED_MISSING_USER_ID,
} from "../tenant-kernel/auth-errors";

const PUBLIC_CATALOG_GUEST_USER_ID = "00000000-0000-4000-0000-000000000001";

/**
 * Public urban catalog + registration intake — tenant from `x-tenant-id` only.
 * Does not require workspace binding (ROLE `none` anonymous actor).
 */
export function resolveUrbanPublicAuth(req: IncomingMessage): TenantAuthContext {
  const headers = readRequestAuthHeaders(req);
  const tenantId = (headers.tenantId ?? headers.authenticatedTenantId)?.trim();
  if (!tenantId) {
    throw new Error(UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT);
  }

  const role = (headers.role?.trim() as ActorRole | undefined) ?? "none";
  const userId = headers.userId?.trim() ?? PUBLIC_CATALOG_GUEST_USER_ID;
  if (role !== "none" && userId.length === 0) {
    throw new Error(UNAUTHORIZED_MISSING_USER_ID);
  }

  return {
    tenantId,
    userId,
    role,
    status: "ACTIVE",
    workspaceId: headers.workspaceId,
  };
}
