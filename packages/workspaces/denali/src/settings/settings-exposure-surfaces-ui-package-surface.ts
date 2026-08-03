/**
 * Thin Shell Phase 4bb / 4bs — package-owned settings exposure surfaces UI registry.
 * Plugin tsc stays free of static `src/ui` imports via string-keyed dynamic import.
 * After warm, surface is published on a product-blind `Map<pluginId, surface>`
 * so the shell can resolve without a generated binder cache.
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no product token). */
export const SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY =
  "app-cloud.settingsExposureSurfacesUiSurface";

export type SettingsExposureSurfacesUiPackageSurface = {
  readonly WorkspaceSurfacesPanel: unknown;
};

type GlobalRegistry = typeof globalThis & {
  [SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY]?: Map<
    string,
    SettingsExposureSurfacesUiPackageSurface
  >;
};

function getCache(): Map<string, SettingsExposureSurfacesUiPackageSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY];
  // Phase 4bs: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[SETTINGS_EXPOSURE_SURFACES_UI_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekSettingsExposureSurfacesUiPackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): SettingsExposureSurfacesUiPackageSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/**
 * Warm + publish settings exposure surfaces UI under plugin id. Idempotent.
 * Invoked from `capabilities.settingsExposureSurfacesUi.ensureReady`.
 */
export async function ensureSettingsExposureSurfacesUiPackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<SettingsExposureSurfacesUiPackageSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekSettingsExposureSurfacesUiPackageSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin tsc does not pull `src/ui` statically.
  // Host binding barrel owns the frozen surface object (panel + export).
  const mod = await import("../ui/settings/settings-exposure-surfaces-ui-binding");
  const next = Object.freeze({
    WorkspaceSurfacesPanel: mod.denaliSettingsExposureSurfacesUiSurface.WorkspaceSurfacesPanel,
  }) as SettingsExposureSurfacesUiPackageSurface;

  getCache().set(id, next);
  return next;
}
