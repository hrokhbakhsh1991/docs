import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { isWorkspaceMetadataEnabled } from "../workspace-metadata/is-workspace-metadata-enabled.ts";
import {
  resolveWorkspacePluginForTenantById,
  type ResolveWorkspacePluginForTenantByIdDeps,
} from "../workspace-metadata/read-tenant-workspace-metadata-binding.ts";
import { resolveWorkspacePluginForType } from "./resolve-workspace-plugin.ts";

/** P3-A-N-011 — tenant-aware plugin resolve for production ingress (Strangler Fig facade). */
export async function resolveWorkspacePluginForTenantContext(
  tenantId: string,
  workspaceType: string,
  deps: ResolveWorkspacePluginForTenantByIdDeps = {}
): Promise<WorkspacePlugin> {
  if (!isWorkspaceMetadataEnabled()) {
    return await resolveWorkspacePluginForType(workspaceType);
  }
  return resolveWorkspacePluginForTenantById(tenantId, deps);
}
