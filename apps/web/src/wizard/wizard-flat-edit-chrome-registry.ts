/**
 * Thin Shell Phase 4ac / 4ah / 4bm — product-blind shell reader for flat-edit chrome.
 * Workspace packages publish on a `Map<pluginId, surface>` from package
 * `flatEditChrome.ensureReady` (flat-edit page warm; not wizardHost.ensureReady).
 * Phase 4ah: generated binder deleted — registry only. Phase 4bm: peek keyed by pluginId.
 */

export const WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY = "app-cloud.wizardFlatEditChromeSurface";

type WizardFlatEditChromeSurface = {
  readonly useFlatEditPageCore: (input: never) => unknown;
  readonly loadSubmitCatalog: (...args: never[]) => Promise<unknown>;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY]?: Map<string, WizardFlatEditChromeSurface>;
};

function getCache(): Map<string, WizardFlatEditChromeSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY];
  // Phase 4bm: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekWizardFlatEditChromeSurface(
  pluginId: string | undefined
): WizardFlatEditChromeSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

function requireWizardFlatEditChromeSurface(pluginId: string): WizardFlatEditChromeSurface {
  const surface = peekWizardFlatEditChromeSurface(pluginId);
  if (surface == null) {
    throw new Error(
      "Wizard flat-edit chrome cold (call flatEditChrome.ensureReady first)"
    );
  }
  return surface;
}

/**
 * Shell hook wrapper — always invokes product hook after warm (no conditional hook calls).
 * Requires package registry keyed by plugin.id (Phase 4bm).
 */
export function useOperatorFlatEditPageCore(input: {
  readonly plugin: { readonly id: string };
}): unknown {
  return requireWizardFlatEditChromeSurface(input.plugin.id).useFlatEditPageCore(input as never);
}

/**
 * Submit-catalog loader — callers must pass pluginId (bound at use-flat-edit-page).
 */
export async function loadOperatorSubmitCatalogIds(
  pluginId: string,
  ...args: never[]
): Promise<unknown> {
  return requireWizardFlatEditChromeSurface(pluginId).loadSubmitCatalog(...args);
}
