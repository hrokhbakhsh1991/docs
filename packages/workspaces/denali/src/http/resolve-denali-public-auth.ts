import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { resolveWorkspacePublicAuthFromRequest } from "@app-tour/workspace-sdk";

/**
 * Public denali catalog — tenant from `x-tenant-id` only.
 * Does not require workspace binding (ROLE `none` anonymous actor).
 */
export function resolveDenaliPublicAuth(req: IncomingMessage): TenantAuthContext {
  return resolveWorkspacePublicAuthFromRequest(req);
}
