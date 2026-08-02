/**
 * Thin Shell Phase 4s — load host-probe view model for the generic shell route.
 * Fail-closed: no product id defaults.
 */
import { resolveHostProbeCapability } from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "./resolve-bootstrap-workspace-plugin";
import { requireWorkspacePluginId } from "./workspace-plugin-context-errors";

export type WorkspaceHostProbeViewModel = {
  readonly pluginId: string;
  readonly title: string;
  readonly body: string;
};

export class WorkspaceHostProbeMissingError extends Error {
  readonly pluginId: string;

  constructor(pluginId: string) {
    super(`Workspace host probe capability missing for pluginId="${pluginId}"`);
    this.name = "WorkspaceHostProbeMissingError";
    this.pluginId = pluginId;
  }
}

export async function loadWorkspaceHostProbeView(
  pluginId: string
): Promise<WorkspaceHostProbeViewModel> {
  const id = requireWorkspacePluginId(pluginId);
  const plugin = await loadBootstrapWorkspacePlugin(id);
  const probe = resolveHostProbeCapability(plugin);
  if (probe == null) {
    throw new WorkspaceHostProbeMissingError(plugin.id);
  }
  return {
    pluginId: plugin.id,
    title: probe.title,
    body: probe.body,
  };
}
