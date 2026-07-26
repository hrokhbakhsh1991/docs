/**
 * Thin Shell Phase 4ad / 4ak / 4bn — product-blind shell reader for create-view.
 * Workspace packages publish on a `Map<pluginId, surface>` from package
 * `createView.ensureReady` (and wizardHost.ensureReady). Phase 4ak: generated
 * binder deleted — registry only. Phase 4bn: peek keyed by pluginId.
 */

import type { ComponentType } from "react";

export const WIZARD_CREATE_VIEW_SURFACE_KEY = "app-cloud.wizardCreateViewSurface";

type WizardCreateViewSurface = {
  readonly CreateTourWizardView: ComponentType<any>;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_CREATE_VIEW_SURFACE_KEY]?: Map<string, WizardCreateViewSurface>;
};

function getCache(): Map<string, WizardCreateViewSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_CREATE_VIEW_SURFACE_KEY];
  // Phase 4bn: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_CREATE_VIEW_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekWizardCreateViewSurface(
  pluginId: string | undefined
): WizardCreateViewSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/** Registry-only resolve (Phase 4ak / 4bn — peek by pluginId). */
export function resolveWizardCreateViewSurface(
  pluginId: string
): WizardCreateViewSurface | null {
  return peekWizardCreateViewSurface(pluginId);
}
