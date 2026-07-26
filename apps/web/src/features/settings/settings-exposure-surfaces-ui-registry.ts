/**
 * Thin Shell Phase 4bb / 4bs — product-blind shell reader for settings exposure surfaces UI.
 * Workspace packages publish on a `Map<pluginId, surface>` from
 * `settingsExposureSurfacesUi.ensureReady`. Generated binder deleted — registry only.
 */

import {
  resolveSettingsExposureSurfacesUiCapability,
  type WorkspacePlugin,
} from "@app-cloud/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { SettingsExposureSurfacesUiSurface } from "@/features/settings/settings-exposure-surfaces-ui-types";

export const SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY =
  "app-cloud.settingsExposureSurfacesUiSurface";

type GlobalRegistry = typeof globalThis & {
  [SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY]?: Map<string, SettingsExposureSurfacesUiSurface>;
};

function getCache(): Map<string, SettingsExposureSurfacesUiSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY];
  // Phase 4bs: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekSettingsExposureSurfacesUiSurface(
  pluginId: string | undefined
): SettingsExposureSurfacesUiSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/**
 * Warm via capability when present; return published surface (or null when omitted).
 */
export async function ensureSettingsExposureSurfacesUiSurface(
  pluginId: string
): Promise<SettingsExposureSurfacesUiSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const existing = peekSettingsExposureSurfacesUiSurface(pluginId);
  if (existing != null) {
    return existing;
  }
  const plugin = await loadBootstrapWorkspacePlugin(pluginId);
  await resolveSettingsExposureSurfacesUiCapability(plugin)?.ensureReady?.();
  return peekSettingsExposureSurfacesUiSurface(pluginId);
}

export function resolveSettingsExposureSurfacesUiSurface(
  pluginId?: string
): SettingsExposureSurfacesUiSurface | null {
  return peekSettingsExposureSurfacesUiSurface(pluginId);
}

/** Warm using an in-hand plugin (preferred when already loaded). */
export async function ensureSettingsExposureSurfacesUiSurfaceForPlugin(
  plugin: WorkspacePlugin
): Promise<SettingsExposureSurfacesUiSurface | null> {
  const existing = peekSettingsExposureSurfacesUiSurface(plugin.id);
  if (existing != null) {
    return existing;
  }
  await resolveSettingsExposureSurfacesUiCapability(plugin)?.ensureReady?.();
  return peekSettingsExposureSurfacesUiSurface(plugin.id);
}
