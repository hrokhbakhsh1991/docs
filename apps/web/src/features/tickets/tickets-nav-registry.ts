/**
 * TKT-G1 — operator tickets inbox nav from capabilities.operatorInbox + module enablement.
 */
import {
  getWorkspaceTicketingCapabilities,
  isTicketingModuleEnabled,
  parseEnabledModulesFromTheme,
  type TicketingModuleEnablementBindings,
} from "@app-tour/workspace-sdk/ticketing";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

export const TICKETS_NAV_CACHE_KEY = "app-cloud.ticketsNavCache";

type GlobalRegistry = typeof globalThis & {
  [TICKETS_NAV_CACHE_KEY]?: Map<string, boolean>;
  "app-cloud.ticketsNavLatest"?: Map<string, boolean>;
};

function getLatestCache(): Map<string, boolean> {
  const g = globalThis as GlobalRegistry;
  let cache = g["app-cloud.ticketsNavLatest"];
  if (cache == null) {
    cache = new Map();
    g["app-cloud.ticketsNavLatest"] = cache;
  }
  return cache;
}

const ticketingModuleBindings: TicketingModuleEnablementBindings = {
  isSupportedWorkspace: (workspaceType) =>
    getWorkspaceTicketingCapabilities(workspaceType)?.supported === true,
  isDefaultEnabledWhenModulesUnset: (workspaceType) =>
    getWorkspaceTicketingCapabilities(workspaceType)?.defaultModuleEnabledWhenUnset === true,
};

function getCache(): Map<string, boolean> {
  const g = globalThis as GlobalRegistry;
  let cache = g[TICKETS_NAV_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[TICKETS_NAV_CACHE_KEY] = cache;
  }
  return cache;
}

function supportedFromPlugin(pluginId: string, theme: unknown): boolean {
  const caps = getWorkspaceTicketingCapabilities(pluginId);
  if (caps === null || caps.operatorInbox !== true) {
    return false;
  }
  return isTicketingModuleEnabled(theme, pluginId, ticketingModuleBindings);
}

function themeCacheSuffix(theme: unknown): string {
  const modules = parseEnabledModulesFromTheme(theme);
  if (modules.length === 0) {
    return "unset";
  }
  return modules.slice().sort().join(",");
}

export async function ensureTicketsNavSupported(
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
    await loadBootstrapWorkspacePlugin(pluginId);
    const supported = supportedFromPlugin(pluginId, theme);
    getCache().set(cacheKey, supported);
    getLatestCache().set(pluginId, supported);
    return supported;
  } catch {
    getCache().set(cacheKey, false);
    getLatestCache().set(pluginId, false);
    return false;
  }
}

export function isTicketsNavPlugin(pluginId: string): boolean {
  return getLatestCache().get(pluginId) ?? false;
}
