import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";
import type { WorkspaceCatalogIntakeSurface } from "./workspace-catalog-intake-surface";

export type RegisteredWorkspaceIntakePlugin = {
  readonly id: WorkspacePluginId;
  readonly catalogIntake: WorkspaceCatalogIntakeSurface;
};

const intakePlugins = new Map<string, RegisteredWorkspaceIntakePlugin>();

export function registerWorkspaceIntakePlugin(plugin: RegisteredWorkspaceIntakePlugin): void {
  intakePlugins.set(plugin.id, plugin);
}

export function getWorkspaceIntakePlugin(
  pluginId: WorkspacePluginId | string
): RegisteredWorkspaceIntakePlugin | null {
  return intakePlugins.get(pluginId) ?? null;
}

export function listWorkspaceIntakePluginIds(): readonly string[] {
  return [...intakePlugins.keys()].sort();
}

/** Test-only reset — never call from production code paths. */
export function clearWorkspaceIntakePluginRegistryForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  intakePlugins.clear();
}
