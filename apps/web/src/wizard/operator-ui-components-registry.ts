/**
 * Thin Shell Phase 4ao / 4bq — product-blind shell reader for operator UI.
 * Workspace packages publish on a `Map<pluginId, surface>` from package
 * `operatorUi.ensureReady` (and wizardHost.ensureReady). Generated binder
 * deleted — registry only. Phase 4bq: peek keyed by pluginId.
 */

import type { ComponentType } from "react";

import {
  resolveOperatorUiCapability,
  type WorkspacePlugin,
} from "@app-cloud/workspace-sdk";

import { loadWizardWorkspacePlugin } from "@/wizard/resolve-wizard-workspace-plugin";

export const OPERATOR_UI_COMPONENTS_SURFACE_KEY = "app-cloud.operatorUiComponentsSurface";

export type OperatorUiComponentsSurface = {
  readonly TimeInput: ComponentType<any>;
  readonly DifficultyRangeSlider: ComponentType<any>;
  readonly LocationPickerMap: ComponentType<any>;
  readonly LocationPickerMapInner: ComponentType<any>;
  readonly ensureLeafletDefaultIcon: () => void;
  readonly WizardDatetimePicker: ComponentType<any>;
};

type GlobalRegistry = typeof globalThis & {
  [OPERATOR_UI_COMPONENTS_SURFACE_KEY]?: Map<string, OperatorUiComponentsSurface>;
};

function getCache(): Map<string, OperatorUiComponentsSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[OPERATOR_UI_COMPONENTS_SURFACE_KEY];
  // Phase 4bq: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[OPERATOR_UI_COMPONENTS_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekOperatorUiComponentsSurface(
  pluginId: string | undefined
): OperatorUiComponentsSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/**
 * Warm via capability when present; return published surface (or null when omitted).
 */
export async function ensureOperatorUiComponentsSurface(
  pluginId: string
): Promise<OperatorUiComponentsSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const existing = peekOperatorUiComponentsSurface(pluginId);
  if (existing != null) {
    return existing;
  }
  const plugin = await loadWizardWorkspacePlugin(pluginId);
  await resolveOperatorUiCapability(plugin)?.ensureReady?.();
  return peekOperatorUiComponentsSurface(pluginId);
}

export function resolveOperatorUiComponentsSurface(
  pluginId?: string
): OperatorUiComponentsSurface | null {
  return peekOperatorUiComponentsSurface(pluginId);
}

/** Warm using an in-hand plugin (preferred when already loaded). */
export async function ensureOperatorUiComponentsSurfaceForPlugin(
  plugin: WorkspacePlugin
): Promise<OperatorUiComponentsSurface | null> {
  const existing = peekOperatorUiComponentsSurface(plugin.id);
  if (existing != null) {
    return existing;
  }
  await resolveOperatorUiCapability(plugin)?.ensureReady?.();
  return peekOperatorUiComponentsSurface(plugin.id);
}
