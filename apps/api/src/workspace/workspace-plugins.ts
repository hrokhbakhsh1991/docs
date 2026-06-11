import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { listApiWorkspacePluginsFromManifest } from "./workspace-plugin-registry.generated";

/**
 * API plugin registry — generated from workspace.manifest.json (DEC-P10-001).
 */
export function listApiWorkspacePlugins(): readonly WorkspacePlugin[] {
  return listApiWorkspacePluginsFromManifest();
}
