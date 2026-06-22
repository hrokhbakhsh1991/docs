import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { loadWorkspacePluginByIdFromRegistry } from "../bootstrap/workspace-plugin-loaders.generated";
import {
  resolveOperatorWorkspacePlugin,
  type OperatorWorkspaceMetadataBinding,
  type ResolveOperatorWorkspacePluginInput,
} from "./resolve-operator-workspace-plugin";

export type {
  OperatorWorkspaceMetadataBinding,
  ResolveOperatorWorkspacePluginDeps,
  ResolveOperatorWorkspacePluginInput,
} from "./resolve-operator-workspace-plugin";

/**
 * Dynamic plugin loader — async boundary for host/tenant plugin resolution (Phase 3.3 / 6.5 / 7.3).
 * Product workspace plugins are dynamically imported so starter routes stay lean.
 */
export async function loadWorkspacePluginById(pluginId: string): Promise<WorkspacePlugin> {
  return loadWorkspacePluginByIdFromRegistry(pluginId);
}

/** P5-B-N-009 — operator Strangler Fig loader (metadata path when flag + binding active). */
export async function loadOperatorWorkspacePlugin(
  input: Omit<ResolveOperatorWorkspacePluginInput, "loadPackagePlugin">
): Promise<WorkspacePlugin> {
  return resolveOperatorWorkspacePlugin(input);
}
