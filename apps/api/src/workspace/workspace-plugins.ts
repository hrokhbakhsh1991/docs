import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  listApiWorkspacePluginIdsFromManifest,
  listApiWorkspacePluginsFromManifest,
  type ApiWorkspacePluginId,
} from "./workspace-plugin-registry.generated";

/**
 * API plugin registry — generated from workspace.manifest.json (DEC-P10-001).
 * P4.2 — async list (warm/admin); prefer per-id load on request paths.
 */
export async function listApiWorkspacePlugins(): Promise<readonly WorkspacePlugin[]> {
  return listApiWorkspacePluginsFromManifest();
}

export function listApiWorkspacePluginIds(): readonly ApiWorkspacePluginId[] {
  return listApiWorkspacePluginIdsFromManifest();
}
