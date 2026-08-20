/**
 * Thin Shell Phase 4af / 4aj / 4bp — product-blind shell reader for flat-edit page.
 * Workspace packages publish on a `Map<pluginId, surface>` from package
 * `flatEditPage.ensureReady` (flat-edit page warm; not wizardHost.ensureReady).
 * Phase 4aj: generated binder deleted — registry only. Phase 4bp: peek keyed by pluginId.
 */

import type { ComponentType } from "react";

export const WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY = "app-cloud.wizardFlatEditPageSurface";

type WizardFlatEditPageSurface = {
  readonly FlatEditPageView: ComponentType<any>;
  readonly FlatEditValidationList: ComponentType<any>;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY]?: Map<string, WizardFlatEditPageSurface>;
};

function getCache(): Map<string, WizardFlatEditPageSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY];
  // Phase 4bp: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekWizardFlatEditPageSurface(
  pluginId: string | undefined
): WizardFlatEditPageSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/** Registry-only resolve (Phase 4aj / 4bp — peek by pluginId). */
export function resolveWizardFlatEditPageSurface(
  pluginId: string
): WizardFlatEditPageSurface | null {
  return peekWizardFlatEditPageSurface(pluginId);
}
