/**
 * Thin Shell Phase 4ab / 4ag / 4bl — product-blind shell reader for create-chrome.
 * Workspace packages publish on a `Map<pluginId, surface>` from package
 * `createChrome.ensureReady` (and wizardHost.ensureReady). Phase 4ag: generated
 * binder deleted — registry only. Phase 4bl: peek keyed by pluginId.
 */

export const WIZARD_CREATE_CHROME_SURFACE_KEY = "app-cloud.wizardCreateChromeSurface";

/** Shell-local mirror of product create-screen union (avoids type-only product import). */
export type OperatorCreateTourWizardScreen =
  | "gate-loading"
  | "clone-loading"
  | "clone-error"
  | "not-configured"
  | "draft-loading"
  | "ready";

type WizardCreateChromeSurface = {
  readonly useCreateTourWizardCore: (input: never) => unknown;
  readonly isDraftEssentiallyEmpty: (draft: never) => boolean;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_CREATE_CHROME_SURFACE_KEY]?: Map<string, WizardCreateChromeSurface>;
};

function getCache(): Map<string, WizardCreateChromeSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_CREATE_CHROME_SURFACE_KEY];
  // Phase 4bl: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_CREATE_CHROME_SURFACE_KEY] = cache;
  }
  return cache;
}

export function peekWizardCreateChromeSurface(
  pluginId: string | undefined
): WizardCreateChromeSurface | null {
  if (pluginId == null || pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

function requireWizardCreateChromeSurface(pluginId: string): WizardCreateChromeSurface {
  const surface = peekWizardCreateChromeSurface(pluginId);
  if (surface == null) {
    throw new Error(
      "Wizard create chrome cold (call createChrome.ensureReady / warmOperatorWizardShell first)"
    );
  }
  return surface;
}

/**
 * Shell hook wrapper — always invokes product hook after warm (no conditional hook calls).
 * Requires package registry keyed by session.pluginId (Phase 4bl).
 */
export function useOperatorCreateTourWizardCore(input: {
  readonly session: { readonly pluginId: string };
}): unknown {
  return requireWizardCreateChromeSurface(input.session.pluginId).useCreateTourWizardCore(
    input as never
  );
}
