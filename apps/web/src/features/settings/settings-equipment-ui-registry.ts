/**
 * Thin Shell Phase 4ba / 4bs — product-blind shell reader for settings equipment UI.
 * Workspace packages publish on a `Map<pluginId, surface>` from
 * `settingsEquipmentUi.ensureReady`. Generated binder deleted — registry only.
 */

import {
  resolveSettingsEquipmentUiCapability,
  type WorkspacePlugin,
} from "@app-cloud/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { SettingsEquipmentUiSurface } from "@/features/settings/settings-equipment-ui-types";

export const SETTINGS_EQUIPMENT_UI_SURFACE_KEY = "app-cloud.settingsEquipmentUiSurface";

type GlobalRegistry = typeof globalThis & {
  [SETTINGS_EQUIPMENT_UI_SURFACE_KEY]?: Map<string, SettingsEquipmentUiSurface>;
};

function getCache(): Map<string, SettingsEquipmentUiSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[SETTINGS_EQUIPMENT_UI_SURFACE_KEY];
  // Phase 4bs: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[SETTINGS_EQUIPMENT_UI_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekSettingsEquipmentUiSurface(
  pluginId: string | undefined
): SettingsEquipmentUiSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/**
 * Warm via capability when present; return published surface (or null when omitted).
 */
export async function ensureSettingsEquipmentUiSurface(
  pluginId: string
): Promise<SettingsEquipmentUiSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const existing = peekSettingsEquipmentUiSurface(pluginId);
  if (existing != null) {
    return existing;
  }
  const plugin = await loadBootstrapWorkspacePlugin(pluginId);
  await resolveSettingsEquipmentUiCapability(plugin)?.ensureReady?.();
  return peekSettingsEquipmentUiSurface(pluginId);
}

export function resolveSettingsEquipmentUiSurface(
  pluginId?: string
): SettingsEquipmentUiSurface | null {
  return peekSettingsEquipmentUiSurface(pluginId);
}

/** Warm using an in-hand plugin (preferred when already loaded). */
export async function ensureSettingsEquipmentUiSurfaceForPlugin(
  plugin: WorkspacePlugin
): Promise<SettingsEquipmentUiSurface | null> {
  const existing = peekSettingsEquipmentUiSurface(plugin.id);
  if (existing != null) {
    return existing;
  }
  await resolveSettingsEquipmentUiCapability(plugin)?.ensureReady?.();
  return peekSettingsEquipmentUiSurface(plugin.id);
}
