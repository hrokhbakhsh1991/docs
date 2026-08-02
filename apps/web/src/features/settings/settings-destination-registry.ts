/**
 * Thin Shell Phase 4az — settings destination via capabilities.settingsDestination.
 * Product-blind warm cache supports sync resolve after ensure; binder deleted.
 */

import {
  resolveSettingsDestinationCapability,
  type WorkspacePlugin,
  type WorkspaceSettingsDestinationCapability,
} from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { DestinationSettingsSurface } from "@/features/settings/destination-settings-surface-types";

export const SETTINGS_DESTINATION_CACHE_KEY = "app-cloud.settingsDestinationCache";

type GlobalRegistry = typeof globalThis & {
  [SETTINGS_DESTINATION_CACHE_KEY]?: Map<string, DestinationSettingsSurface>;
};

function getCache(): Map<string, DestinationSettingsSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[SETTINGS_DESTINATION_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[SETTINGS_DESTINATION_CACHE_KEY] = cache;
  }
  return cache;
}

function surfaceFromPlugin(plugin: WorkspacePlugin): DestinationSettingsSurface | null {
  const cap: WorkspaceSettingsDestinationCapability | undefined =
    resolveSettingsDestinationCapability(plugin);
  if (cap == null) {
    return null;
  }
  return cap as DestinationSettingsSurface;
}

/** Warm product surface via capability (no generated binder). */
export async function ensureSettingsDestinationSurface(
  pluginId: string
): Promise<DestinationSettingsSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = getCache().get(pluginId);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(pluginId);
    const surface = surfaceFromPlugin(plugin);
    if (surface == null) {
      return null;
    }
    getCache().set(pluginId, surface);
    return surface;
  } catch {
    return null;
  }
}

/** Sync read of warm cache — call ensureSettingsDestinationSurface first. */
export function resolveSettingsDestinationSurface(
  pluginId: string
): DestinationSettingsSurface | null {
  return getCache().get(pluginId) ?? null;
}
