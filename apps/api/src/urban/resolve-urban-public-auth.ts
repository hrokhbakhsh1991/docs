import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { resolveUrbanPublicAuthFromHeaders } from "@app-tour/workspace-urban/http";

import { readRequestAuthHeaders } from "../auth/read-request-headers";

export { PUBLIC_CATALOG_GUEST_USER_ID } from "@app-tour/workspace-urban/http";

/**
 * Public urban catalog + registration intake — tenant from `x-tenant-id` only.
 * Thin wrapper over workspace-sdk resolver (header normalization via readRequestAuthHeaders).
 */
export function resolveUrbanPublicAuth(req: IncomingMessage): TenantAuthContext {
  return resolveUrbanPublicAuthFromHeaders(readRequestAuthHeaders(req));
}
