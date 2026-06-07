import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban";

/**
 * API-local plugin registry (Phase 5.2 / 6.5 / 7.3). Eager load bound workspace packages.
 */
export function listApiWorkspacePlugins(): readonly WorkspacePlugin[] {
  return [getStarterWorkspacePlugin(), getDenaliWorkspacePlugin(), getUrbanWorkspacePlugin()];
}
