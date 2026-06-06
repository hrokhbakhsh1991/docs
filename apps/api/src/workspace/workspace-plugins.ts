import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

/**
 * API-local plugin registry (Phase 5.2). Extend when Phase 6 adds non-starter workspace binaries.
 */
export function listApiWorkspacePlugins(): readonly WorkspacePlugin[] {
  return [getStarterWorkspacePlugin()];
}
