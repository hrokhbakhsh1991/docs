import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";
import type { WorkspaceCatalogRegistrationFlowSurface } from "./registration-flow.contract";

export type RegisteredWorkspaceRegistrationFlowPlugin = {
  readonly id: WorkspacePluginId;
  readonly catalogRegistrationFlow: WorkspaceCatalogRegistrationFlowSurface;
};

const registrationFlowPlugins = new Map<string, RegisteredWorkspaceRegistrationFlowPlugin>();

export function registerWorkspaceRegistrationFlowPlugin(
  plugin: RegisteredWorkspaceRegistrationFlowPlugin
): void {
  registrationFlowPlugins.set(plugin.id, plugin);
}

export function getWorkspaceRegistrationFlowPlugin(
  pluginId: WorkspacePluginId | string
): RegisteredWorkspaceRegistrationFlowPlugin | null {
  return registrationFlowPlugins.get(pluginId) ?? null;
}

export function listWorkspaceRegistrationFlowPluginIds(): readonly string[] {
  return [...registrationFlowPlugins.keys()].sort();
}

/** Test-only reset — never call from production code paths. */
export function clearWorkspaceRegistrationFlowRegistryForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  registrationFlowPlugins.clear();
}
