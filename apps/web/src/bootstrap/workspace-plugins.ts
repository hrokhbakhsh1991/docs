/**
 * Phase 3.3 — dynamic workspace registry (no static `workspaces/*` imports).
 * Starter plugin reference only until tenant-kernel resolves plugin by host.
 */
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

const STARTER_PLUGINS: readonly WorkspacePlugin[] = [getStarterWorkspacePlugin()];

export function listBootstrapWorkspacePlugins(): readonly WorkspacePlugin[] {
  return STARTER_PLUGINS;
}
