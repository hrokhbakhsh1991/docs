import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveProductionCertificationForPlugin,
  resolveWorkspacePluginIdForType,
  type WorkspaceTypeId,
} from "@app-tour/workspace-sdk";

import { WorkspaceNotCertifiedForProductionError } from "./provisioning.errors";

/**
 * Phase H2 — fail-closed gate for {@link ProvisioningService.provisionTenantProduction}.
 * Dev provisioning (`provisionTenant`, smoke seeds) does not call this.
 */
export function assertProductionCertifiedWorkspaceType(workspaceType: string): void {
  const pluginId = resolveWorkspacePluginIdForType(
    workspaceType as WorkspaceTypeId,
    DEFAULT_WORKSPACE_TYPE_BINDINGS
  );
  if (pluginId === null) {
    throw new Error(`WORKSPACE_PLUGIN_NOT_BOUND:${workspaceType}`);
  }
  const tier = resolveProductionCertificationForPlugin(pluginId);
  if (tier !== "certified") {
    throw new WorkspaceNotCertifiedForProductionError(workspaceType, pluginId);
  }
}
