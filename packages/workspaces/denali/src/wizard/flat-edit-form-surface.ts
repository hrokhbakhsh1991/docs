/**
 * Thin Shell Phase 4ae / 4bo — package-owned flat-edit form surface registry.
 * Wizard/plugin tsc stays free of static `src/ui` imports via string-keyed
 * dynamic import. After warm, surface is published on a product-blind
 * `Map<pluginId, surface>` so the shell can resolve without a generated binder
 * (Phase 4ai deleted the flat-edit form binder; 4bo keyed by pluginId).
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const WIZARD_FLAT_EDIT_FORM_SURFACE_KEY = "app-cloud.wizardFlatEditFormSurface";

export type WizardFlatEditFormSurface = {
  /** Opaque React component — shell owns rendering. */
  readonly FlatEditForm: unknown;
  readonly testIds: unknown;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_FLAT_EDIT_FORM_SURFACE_KEY]?: Map<string, WizardFlatEditFormSurface>;
};

function getCache(): Map<string, WizardFlatEditFormSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_FLAT_EDIT_FORM_SURFACE_KEY];
  // Phase 4bo: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_FLAT_EDIT_FORM_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekWizardFlatEditFormSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardFlatEditFormSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

export function requireWizardFlatEditFormSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardFlatEditFormSurface {
  const current = peekWizardFlatEditFormSurface(pluginId);
  if (current == null) {
    throw new Error(
      "Wizard flat-edit form cold (call flatEditForm.ensureReady / ensureWizardFlatEditFormPackageSurface first)"
    );
  }
  return current;
}

/**
 * Warm + publish flat-edit form surface under plugin id. Idempotent.
 * Invoked from `capabilities.flatEditForm.ensureReady` and wizardHost ensureReady.
 */
export async function ensureWizardFlatEditFormPackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<WizardFlatEditFormSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardFlatEditFormSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin/wizard tsc does not pull `src/ui` statically.
  const specifier = "../ui/chrome/wizard-flat-edit-form-surface";
  const mod = await import(specifier);
  const next = Object.freeze({
    FlatEditForm: mod.denaliWizardFlatEditFormSurface.FlatEditForm,
    testIds: mod.denaliWizardFlatEditFormSurface.testIds,
  }) as WizardFlatEditFormSurface;

  getCache().set(id, next);
  return next;
}
