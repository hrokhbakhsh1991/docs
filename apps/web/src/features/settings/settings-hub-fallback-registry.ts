/**
 * Thin Shell Phase 4av — settings hub fallback via capabilities.settingsHubFallback.
 * Product-blind warm cache supports sync resolve after ensure; binder deleted.
 */

import {
  resolveSettingsHubFallbackCapability,
  type WorkspacePlugin,
} from "@app-cloud/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { SettingsModuleMetadata } from "@/features/settings/settings-module-types";

export const SETTINGS_HUB_FALLBACK_CACHE_KEY = "app-cloud.settingsHubFallbackCache";

export type SettingsHubFallbackPolicy = {
  readonly requiredModuleIds: readonly string[];
  readonly fallbackModules: Readonly<Record<string, SettingsModuleMetadata>>;
};

type GlobalRegistry = typeof globalThis & {
  [SETTINGS_HUB_FALLBACK_CACHE_KEY]?: Map<string, SettingsHubFallbackPolicy>;
};

function getCache(): Map<string, SettingsHubFallbackPolicy> {
  const g = globalThis as GlobalRegistry;
  let cache = g[SETTINGS_HUB_FALLBACK_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[SETTINGS_HUB_FALLBACK_CACHE_KEY] = cache;
  }
  return cache;
}

function policyFromPlugin(plugin: WorkspacePlugin): SettingsHubFallbackPolicy | null {
  const cap = resolveSettingsHubFallbackCapability(plugin);
  if (cap == null) {
    return null;
  }
  return Object.freeze({
    requiredModuleIds: cap.requiredModuleIds,
    fallbackModules: cap.fallbackModules as Readonly<Record<string, SettingsModuleMetadata>>,
  });
}

export async function ensureSettingsHubFallbackPolicy(
  pluginId: string
): Promise<SettingsHubFallbackPolicy | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = getCache().get(pluginId);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(pluginId);
    const policy = policyFromPlugin(plugin);
    if (policy == null) {
      return null;
    }
    getCache().set(pluginId, policy);
    return policy;
  } catch {
    return null;
  }
}

/** Sync read of warm cache — call ensureSettingsHubFallbackPolicy first. */
export function resolveSettingsHubFallbackPolicy(
  pluginId: string
): SettingsHubFallbackPolicy | null {
  return getCache().get(pluginId) ?? null;
}
