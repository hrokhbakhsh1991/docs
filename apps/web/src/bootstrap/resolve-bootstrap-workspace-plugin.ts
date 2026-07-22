/**
 * Async workspace plugin resolver for host bootstrap (server).
 * Delegates to codegen dynamic-import registry — no sync fan-in.
 */
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { loadWorkspacePluginByIdFromRegistry } from "./workspace-plugin-loaders.generated";

export async function loadBootstrapWorkspacePlugin(pluginId: string): Promise<WorkspacePlugin> {
  try {
    return await loadWorkspacePluginByIdFromRegistry(pluginId);
  } catch {
    return loadWorkspacePluginByIdFromRegistry("starter");
  }
}
