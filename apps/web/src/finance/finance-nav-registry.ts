/**
 * Thin Shell Phase 4bd — finance hub enablement via capabilities.financeNav.
 * Product-blind warm cache supports sync isFinanceNavPlugin after ensure.
 */

import {
  resolveFinanceNavCapability,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

export const FINANCE_NAV_CACHE_KEY = "app-cloud.financeNavCache";

type GlobalRegistry = typeof globalThis & {
  [FINANCE_NAV_CACHE_KEY]?: Map<string, boolean>;
};

function getCache(): Map<string, boolean> {
  const g = globalThis as GlobalRegistry;
  let cache = g[FINANCE_NAV_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[FINANCE_NAV_CACHE_KEY] = cache;
  }
  return cache;
}

function supportedFromPlugin(plugin: WorkspacePlugin): boolean {
  return resolveFinanceNavCapability(plugin)?.supported === true;
}

/** Warm finance-nav flag via capability (no generated binder). */
export async function ensureFinanceNavSupported(pluginId: string): Promise<boolean> {
  if (pluginId.trim().length === 0) {
    return false;
  }
  const cached = getCache().get(pluginId);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(pluginId);
    const supported = supportedFromPlugin(plugin);
    getCache().set(pluginId, supported);
    return supported;
  } catch {
    getCache().set(pluginId, false);
    return false;
  }
}

/**
 * Sync read of warm cache — call ensureFinanceNavSupported first.
 * Cold / unknown pluginId ⇒ false (fail-closed).
 */
export function isFinanceNavPlugin(pluginId: string): boolean {
  return getCache().get(pluginId) ?? false;
}
