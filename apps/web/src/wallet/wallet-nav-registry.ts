/**
 * WALLET-P3B — wallet ops hub enablement via capabilities.walletNav.
 * Product-blind warm cache supports sync isWalletNavPlugin after ensure.
 */

import {
  getWorkspaceWalletCapabilities,
  isWalletModuleEnabled,
  parseEnabledModulesFromTheme,
  resolveWalletNavCapability,
  type WalletModuleEnablementBindings,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

export const WALLET_NAV_CACHE_KEY = "app-cloud.walletNavCache";

type GlobalRegistry = typeof globalThis & {
  [WALLET_NAV_CACHE_KEY]?: Map<string, boolean>;
  "app-cloud.walletNavLatest"?: Map<string, boolean>;
};

function getLatestCache(): Map<string, boolean> {
  const g = globalThis as GlobalRegistry;
  let cache = g["app-cloud.walletNavLatest"];
  if (cache == null) {
    cache = new Map();
    g["app-cloud.walletNavLatest"] = cache;
  }
  return cache;
}

const walletModuleBindings: WalletModuleEnablementBindings = {
  isSupportedWorkspace: (workspaceType) => getWorkspaceWalletCapabilities(workspaceType) !== null,
  isDefaultEnabledWhenModulesUnset: (workspaceType) =>
    getWorkspaceWalletCapabilities(workspaceType)?.defaultModuleEnabledWhenUnset === true,
};

function getCache(): Map<string, boolean> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WALLET_NAV_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[WALLET_NAV_CACHE_KEY] = cache;
  }
  return cache;
}

function supportedFromPlugin(plugin: WorkspacePlugin, pluginId: string, theme: unknown): boolean {
  if (resolveWalletNavCapability(plugin)?.supported !== true) {
    return false;
  }
  const caps = getWorkspaceWalletCapabilities(pluginId);
  if (caps === null || caps.ops !== true) {
    return false;
  }
  return isWalletModuleEnabled(theme, pluginId, walletModuleBindings);
}

function themeCacheSuffix(theme: unknown): string {
  const modules = parseEnabledModulesFromTheme(theme);
  if (modules.length === 0) {
    return "unset";
  }
  return modules.slice().sort().join(",");
}

/** Warm wallet-nav flag via capability + module enablement (no generated binder). */
export async function ensureWalletNavSupported(
  pluginId: string,
  theme: unknown = null,
): Promise<boolean> {
  if (pluginId.trim().length === 0) {
    return false;
  }
  const cacheKey = `${pluginId}::${themeCacheSuffix(theme)}`;
  const cached = getCache().get(cacheKey);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(pluginId);
    const supported = supportedFromPlugin(plugin, pluginId, theme);
    getCache().set(cacheKey, supported);
    getLatestCache().set(pluginId, supported);
    return supported;
  } catch {
    getCache().set(cacheKey, false);
    getLatestCache().set(pluginId, false);
    return false;
  }
}

/**
 * Sync read of warm cache — call ensureWalletNavSupported first.
 * Cold / unknown pluginId ⇒ false (fail-closed).
 */
export function isWalletNavPlugin(pluginId: string): boolean {
  return getLatestCache().get(pluginId) ?? false;
}
