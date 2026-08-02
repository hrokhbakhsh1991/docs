/**
 * Thin Shell Phase 4bc — operator shell Phase 3 nav via capabilities.operatorShellNav.
 * Product-blind warm cache supports sync resolve after ensure; binder deleted.
 */

import {
  resolveOperatorShellNavCapability,
  type WorkspaceOperatorShellNavLink,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

export const OPERATOR_SHELL_NAV_CACHE_KEY = "app-cloud.operatorShellNavCache";

export type OperatorShellNavLink = WorkspaceOperatorShellNavLink;

type GlobalRegistry = typeof globalThis & {
  [OPERATOR_SHELL_NAV_CACHE_KEY]?: Map<string, readonly OperatorShellNavLink[]>;
};

function getCache(): Map<string, readonly OperatorShellNavLink[]> {
  const g = globalThis as GlobalRegistry;
  let cache = g[OPERATOR_SHELL_NAV_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[OPERATOR_SHELL_NAV_CACHE_KEY] = cache;
  }
  return cache;
}

function linksFromPlugin(plugin: WorkspacePlugin): readonly OperatorShellNavLink[] {
  return resolveOperatorShellNavCapability(plugin)?.links ?? [];
}

/** Warm Phase 3 nav links via capability (no generated binder). */
export async function ensureOperatorShellNavLinks(
  pluginId: string
): Promise<readonly OperatorShellNavLink[]> {
  if (pluginId.trim().length === 0) {
    return [];
  }
  const cached = getCache().get(pluginId);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(pluginId);
    const links = linksFromPlugin(plugin);
    getCache().set(pluginId, links);
    return links;
  } catch {
    getCache().set(pluginId, []);
    return [];
  }
}

/** Sync read of warm cache — call ensureOperatorShellNavLinks first. */
export function resolveOperatorShellNavLinks(pluginId: string): readonly OperatorShellNavLink[] {
  return getCache().get(pluginId) ?? [];
}
