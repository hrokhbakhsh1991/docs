/**
 * Thin Shell Phase 4ad / 4bn — package-owned create-view surface registry.
 * Wizard/plugin tsc stays free of static `src/ui` imports via string-keyed
 * dynamic import. After warm, surface is published on a product-blind
 * `Map<pluginId, surface>` so the shell can resolve without a generated binder
 * (Phase 4ak deleted the create-view binder; 4bn keyed by pluginId).
 */

import type { ComponentType } from "react";

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const WIZARD_CREATE_VIEW_SURFACE_KEY = "app-cloud.wizardCreateViewSurface";

export type WizardCreateViewSurface = {
  readonly CreateTourWizardView: ComponentType<never>;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_CREATE_VIEW_SURFACE_KEY]?: Map<string, WizardCreateViewSurface>;
};

function getCache(): Map<string, WizardCreateViewSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_CREATE_VIEW_SURFACE_KEY];
  // Phase 4bn: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_CREATE_VIEW_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekWizardCreateViewSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardCreateViewSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

export function requireWizardCreateViewSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): WizardCreateViewSurface {
  const current = peekWizardCreateViewSurface(pluginId);
  if (current == null) {
    throw new Error(
      "Wizard create view cold (call createView.ensureReady / ensureWizardCreateViewPackageSurface first)"
    );
  }
  return current;
}

/**
 * Warm + publish create-view surface under plugin id. Idempotent.
 * Invoked from `capabilities.createView.ensureReady` and wizardHost ensureReady.
 */
export async function ensureWizardCreateViewPackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<WizardCreateViewSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardCreateViewSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin/wizard tsc does not pull `src/ui` statically.
  const mod = await import("../ui/chrome/wizard-create-view-surface");
  const next = Object.freeze({
    CreateTourWizardView: mod.denaliWizardCreateViewSurface.CreateTourWizardView,
  }) as WizardCreateViewSurface;

  getCache().set(id, next);
  return next;
}
