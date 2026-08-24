import type { IncomingMessage } from "node:http";

import type { RequestAuthHeaders } from "./request-context";

/** Raw header passthrough — no fabricated defaults (TenantKernel enforces required fields). */
export function readRequestAuthHeaders(req: IncomingMessage): RequestAuthHeaders {
  return {
    tenantId: headerValue(req.headers["x-tenant-id"]),
    authenticatedTenantId:
      headerValue(req.headers["x-authenticated-tenant-id"]) ??
      headerValue(req.headers["x-tenant-id"]),
    userId: headerValue(req.headers["x-user-id"]),
    role:
      headerValue(req.headers["x-actor-role"]) ?? headerValue(req.headers["x-user-role"]),
    status:
      headerValue(req.headers["x-membership-status"]) ??
      headerValue(req.headers["x-user-status"]),
    workspaceId: headerValue(req.headers["x-workspace-id"]),
  };
}

function headerValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
