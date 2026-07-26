/**
 * Async workspace plugin resolver for host bootstrap (server).
 * Delegates to codegen dynamic-import registry — no sync fan-in.
 * Fail-closed: never falls back to a product id.
 */
import type { WorkspacePlugin } from "@app-cloud/workspace-sdk";

import {
  WorkspacePluginNotFoundError,
  isWorkspacePluginNotFoundMessage,
  requireWorkspacePluginId,
} from "./workspace-plugin-context-errors";
import { loadWorkspacePluginByIdFromRegistry } from "./workspace-plugin-loaders.generated";

export async function loadBootstrapWorkspacePlugin(pluginId: string): Promise<WorkspacePlugin> {
  const id = requireWorkspacePluginId(pluginId);
  try {
    return await loadWorkspacePluginByIdFromRegistry(id);
  } catch (error) {
    if (error instanceof Error && isWorkspacePluginNotFoundMessage(error.message)) {
      throw new WorkspacePluginNotFoundError(id);
    }
    throw error;
  }
}
