import type { IncomingMessage } from "node:http";
import {
  resolveWorkspacePublicAuthFromHeaders,
  resolveWorkspacePublicAuthFromRequest,
  WORKSPACE_PUBLIC_AUTH_MISSING_TENANT,
  WORKSPACE_PUBLIC_AUTH_MISSING_USER_ID,
  WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
  type WorkspacePublicAuthHeaderInput,
} from "@app-tour/workspace-sdk";

/** Stable re-export — guests on public catalog / registration intake. */
export const PUBLIC_CATALOG_GUEST_USER_ID = WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID;
export const URBAN_PUBLIC_AUTH_MISSING_TENANT = WORKSPACE_PUBLIC_AUTH_MISSING_TENANT;
export const URBAN_PUBLIC_AUTH_MISSING_USER_ID = WORKSPACE_PUBLIC_AUTH_MISSING_USER_ID;

export type UrbanPublicAuthHeaderInput = WorkspacePublicAuthHeaderInput;

/** Shared resolver — apps/api passes `readRequestAuthHeaders` output. */
export function resolveUrbanPublicAuthFromHeaders(
  headers: UrbanPublicAuthHeaderInput,
) {
  return resolveWorkspacePublicAuthFromHeaders(headers);
}

/**
 * Public urban catalog + registration intake — tenant from `x-tenant-id` only.
 */
export function resolveUrbanPublicAuth(req: IncomingMessage) {
  return resolveWorkspacePublicAuthFromRequest(req);
}
