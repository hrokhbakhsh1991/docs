/**
 * Sync workspace plugin resolver for host bootstrap (server + client hydrate).
 * Static imports from published workspace packages — allowed in apps/web host only.
 */
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban/plugin";

const pluginsById = new Map<string, WorkspacePlugin>([
  ["starter", getStarterWorkspacePlugin()],
  ["denali", getDenaliWorkspacePlugin()],
  ["urban", getUrbanWorkspacePlugin()],
]);

export function resolveBootstrapWorkspacePlugin(pluginId: string): WorkspacePlugin {
  return pluginsById.get(pluginId) ?? getStarterWorkspacePlugin();
}
