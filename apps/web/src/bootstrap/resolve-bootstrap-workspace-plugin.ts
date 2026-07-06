/**
 * Sync workspace plugin resolver for host bootstrap (server + client hydrate).
 * Delegates to codegen registry map — no direct workspace package imports here.
 */
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { resolveSyncWorkspacePluginFromRegistry } from "./workspace-plugin-loaders.generated";

export function resolveBootstrapWorkspacePlugin(pluginId: string): WorkspacePlugin {
  try {
    return resolveSyncWorkspacePluginFromRegistry(pluginId);
  } catch {
    return resolveSyncWorkspacePluginFromRegistry("starter");
  }
}
