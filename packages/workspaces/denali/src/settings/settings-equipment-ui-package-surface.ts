/**
 * Thin Shell Phase 4ba / 4bs — package-owned settings equipment UI surface registry.
 * Plugin tsc stays free of static `src/ui` imports via string-keyed dynamic import.
 * After warm, surface is published on a product-blind `Map<pluginId, surface>`
 * so the shell can resolve without a generated binder cache.
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";
import { importUiSurface } from "../wizard/import-ui-surface";

/** Product-blind registry key (shell + workspace agree; no product token). */
export const SETTINGS_EQUIPMENT_UI_SURFACE_KEY = "app-cloud.settingsEquipmentUiSurface";

export type SettingsEquipmentUiPackageSurface = {
  readonly EquipmentCatalogAvatar: unknown;
  readonly EquipmentIconPicker: unknown;
  readonly TourThemeCatalogAvatar: unknown;
};

type GlobalRegistry = typeof globalThis & {
  [SETTINGS_EQUIPMENT_UI_SURFACE_KEY]?: Map<string, SettingsEquipmentUiPackageSurface>;
};

function getCache(): Map<string, SettingsEquipmentUiPackageSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[SETTINGS_EQUIPMENT_UI_SURFACE_KEY];
  // Phase 4bs: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[SETTINGS_EQUIPMENT_UI_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekSettingsEquipmentUiPackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): SettingsEquipmentUiPackageSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/**
 * Warm + publish settings equipment UI surface under plugin id. Idempotent.
 * Invoked from `capabilities.settingsEquipmentUi.ensureReady`.
 */
export async function ensureSettingsEquipmentUiPackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<SettingsEquipmentUiPackageSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekSettingsEquipmentUiPackageSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin tsc does not pull `src/ui` statically.
  const mod = await importUiSurface("../ui/settings/settings-equipment-ui-surface");
  const next = Object.freeze({
    EquipmentCatalogAvatar: mod.denaliSettingsEquipmentUiSurface.EquipmentCatalogAvatar,
    EquipmentIconPicker: mod.denaliSettingsEquipmentUiSurface.EquipmentIconPicker,
    TourThemeCatalogAvatar: mod.denaliSettingsEquipmentUiSurface.TourThemeCatalogAvatar,
  }) as SettingsEquipmentUiPackageSurface;

  getCache().set(id, next);
  return next;
}
