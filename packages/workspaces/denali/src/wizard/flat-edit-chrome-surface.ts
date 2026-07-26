/**
 * Thin Shell Phase 4ac / 4bm — package-owned flat-edit chrome surface registry.
 * Wizard/plugin tsc stays free of static `src/ui` imports via string-keyed
 * dynamic import. After warm, surface is published on a product-blind
 * `Map<pluginId, surface>` so the shell can resolve without a generated binder
 * (Phase 4ah deleted the flat-edit chrome binder; 4bm keyed by pluginId).
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY = "app-cloud.wizardFlatEditChromeSurface";

export type WizardFlatEditChromeSurface = {
  readonly useFlatEditPageCore: (input: never) => unknown;
  readonly loadSubmitCatalog: (...args: never[]) => Promise<unknown>;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY]?: Map<string, WizardFlatEditChromeSurface>;
};

function getCache(): Map<string, WizardFlatEditChromeSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY];
  // Phase 4bm: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekWizardFlatEditChromeSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardFlatEditChromeSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

export function requireWizardFlatEditChromeSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardFlatEditChromeSurface {
  const current = peekWizardFlatEditChromeSurface(pluginId);
  if (current == null) {
    throw new Error(
      "Wizard flat-edit chrome cold (call flatEditChrome.ensureReady / ensureWizardFlatEditChromePackageSurface first)"
    );
  }
  return current;
}

/**
 * Warm + publish flat-edit chrome surface under plugin id. Idempotent.
 * Invoked from `capabilities.flatEditChrome.ensureReady` and wizardHost ensureReady.
 */
export async function ensureWizardFlatEditChromePackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<WizardFlatEditChromeSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardFlatEditChromeSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin/wizard tsc does not pull `src/ui` statically.
  const specifier = "../ui/chrome/wizard-flat-edit-chrome-surface";
  const mod = await import(specifier);
  const next = Object.freeze({
    useFlatEditPageCore: mod.denaliWizardFlatEditChromeSurface.useFlatEditPageCore,
    loadSubmitCatalog: mod.denaliWizardFlatEditChromeSurface.loadSubmitCatalog,
  }) as WizardFlatEditChromeSurface;

  getCache().set(id, next);
  return next;
}
