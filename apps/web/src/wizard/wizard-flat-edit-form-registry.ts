/**
 * Thin Shell Phase 4ae / 4ai / 4bo — product-blind shell reader for flat-edit form.
 * Workspace packages publish on a `Map<pluginId, surface>` from package
 * `flatEditForm.ensureReady` (flat-edit page warm; not wizardHost.ensureReady).
 * Phase 4ai: generated binder deleted — registry only. Phase 4bo: peek keyed by pluginId.
 */

import type { ComponentType } from "react";

export const WIZARD_FLAT_EDIT_FORM_SURFACE_KEY = "app-cloud.wizardFlatEditFormSurface";

type WizardFlatEditFormSurface = {
  readonly FlatEditForm: ComponentType<any>;
  readonly testIds: unknown;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_FLAT_EDIT_FORM_SURFACE_KEY]?: Map<string, WizardFlatEditFormSurface>;
};

function getCache(): Map<string, WizardFlatEditFormSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_FLAT_EDIT_FORM_SURFACE_KEY];
  // Phase 4bo: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_FLAT_EDIT_FORM_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekWizardFlatEditFormSurface(
  pluginId: string | undefined
): WizardFlatEditFormSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

/** Registry-only resolve (Phase 4ai / 4bo — peek by pluginId). */
export function resolveWizardFlatEditFormSurface(
  pluginId: string
): WizardFlatEditFormSurface | null {
  return peekWizardFlatEditFormSurface(pluginId);
}

/** Registry-only testIds (Phase 4ai / 4bo — peek by pluginId). */
export function resolveOperatorFlatEditTestIds(pluginId: string): unknown {
  return peekWizardFlatEditFormSurface(pluginId)?.testIds ?? null;
}
