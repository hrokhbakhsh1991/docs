/**
 * Thin Shell Phase 4ab / 4bl — package-owned create-chrome surface registry.
 * Wizard/plugin tsc stays free of static `src/ui` imports via string-keyed
 * dynamic import. After warm, surface is published on a product-blind
 * `Map<pluginId, surface>` so the shell can resolve without a generated binder
 * (Phase 4ag deleted the create-chrome binder; 4bl keyed by pluginId).
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const WIZARD_CREATE_CHROME_SURFACE_KEY = "app-cloud.wizardCreateChromeSurface";

export type WizardCreateChromeSurface = {
  readonly useCreateTourWizardCore: (input: never) => unknown;
  readonly isDraftEssentiallyEmpty: (draft: never) => boolean;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_CREATE_CHROME_SURFACE_KEY]?: Map<string, WizardCreateChromeSurface>;
};

function getCache(): Map<string, WizardCreateChromeSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_CREATE_CHROME_SURFACE_KEY];
  // Phase 4bl: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_CREATE_CHROME_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekWizardCreateChromeSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardCreateChromeSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

export function requireWizardCreateChromeSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardCreateChromeSurface {
  const current = peekWizardCreateChromeSurface(pluginId);
  if (current == null) {
    throw new Error(
      "Wizard create chrome cold (call createChrome.ensureReady / ensureWizardCreateChromePackageSurface first)"
    );
  }
  return current;
}

/**
 * Warm + publish create-chrome surface under plugin id. Idempotent.
 * Invoked from `capabilities.createChrome.ensureReady` and wizardHost ensureReady.
 */
export async function ensureWizardCreateChromePackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<WizardCreateChromeSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardCreateChromeSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin/wizard tsc does not pull `src/ui` statically.
  const mod = await import("../ui/chrome/wizard-create-chrome-surface");
  const next = Object.freeze({
    useCreateTourWizardCore: mod.denaliWizardCreateChromeSurface.useCreateTourWizardCore,
    isDraftEssentiallyEmpty: mod.denaliWizardCreateChromeSurface.isDraftEssentiallyEmpty,
  }) as WizardCreateChromeSurface;

  getCache().set(id, next);
  return next;
}
