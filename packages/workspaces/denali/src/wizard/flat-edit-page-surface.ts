/**
 * Thin Shell Phase 4af / 4bp — package-owned flat-edit page surface registry.
 * Wizard/plugin tsc stays free of static `src/ui` imports via string-keyed
 * dynamic import. After warm, surface is published on a product-blind
 * `Map<pluginId, surface>` so the shell can resolve without a generated binder
 * (Phase 4aj deleted the flat-edit page binder; 4bp keyed by pluginId).
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY = "app-cloud.wizardFlatEditPageSurface";

export type WizardFlatEditPageSurface = {
  /** Opaque React components — shell owns rendering. */
  readonly FlatEditPageView: unknown;
  readonly FlatEditValidationList: unknown;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY]?: Map<string, WizardFlatEditPageSurface>;
};

function getCache(): Map<string, WizardFlatEditPageSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY];
  // Phase 4bp: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekWizardFlatEditPageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardFlatEditPageSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

export function requireWizardFlatEditPageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardFlatEditPageSurface {
  const current = peekWizardFlatEditPageSurface(pluginId);
  if (current == null) {
    throw new Error(
      "Wizard flat-edit page cold (call flatEditPage.ensureReady / ensureWizardFlatEditPagePackageSurface first)"
    );
  }
  return current;
}

/**
 * Warm + publish flat-edit page surface under plugin id. Idempotent.
 * Invoked from `capabilities.flatEditPage.ensureReady` (flat-edit page owns warm).
 * Not part of `wizardHost.ensureReady` — create warm must stay lean.
 */
export async function ensureWizardFlatEditPagePackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<WizardFlatEditPageSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardFlatEditPageSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin/wizard tsc does not pull `src/ui` statically.
  const mod = await import("../ui/chrome/wizard-flat-edit-page-surface");
  const next = Object.freeze({
    FlatEditPageView: mod.denaliWizardFlatEditPageSurface.FlatEditPageView,
    FlatEditValidationList: mod.denaliWizardFlatEditPageSurface.FlatEditValidationList,
  }) as WizardFlatEditPageSurface;

  getCache().set(id, next);
  return next;
}
