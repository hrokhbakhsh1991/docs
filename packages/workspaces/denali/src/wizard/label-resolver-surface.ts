/**
 * Thin Shell Phase 4aq / 4bl — package-owned wizard label resolver registry.
 * Wizard/plugin tsc stays free of static `src/ui` imports via string-keyed
 * dynamic import. After warm, resolvers are published on a product-blind
 * globalThis cache so the shell can resolve without a generated binder.
 * Phase 4bl: publish key = `DENALI_WORKSPACE_PLUGIN_ID` (not a bare string).
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const WIZARD_LABEL_RESOLVER_CACHE_KEY = "app-cloud.wizardLabelResolverCache";

export type WizardLabelResolverSurface = {
  readonly resolveFieldLabel: (translate: (key: string) => string, canonicalPath: string) => string;
  readonly resolveStepLabel?: (translate: (key: string) => string, stepId: string) => string;
  readonly resolveEnumOptionLabel?: (
    translate: (key: string) => string,
    canonicalPath: string,
    value: string
  ) => string;
  readonly resolveValidationIssueLabel?: (
    translate: (key: string) => string,
    pathOrCompositeId: string
  ) => string;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_LABEL_RESOLVER_CACHE_KEY]?: Map<string, WizardLabelResolverSurface>;
};

function getCache(): Map<string, WizardLabelResolverSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_LABEL_RESOLVER_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[WIZARD_LABEL_RESOLVER_CACHE_KEY] = cache;
  }
  return cache;
}

export function peekWizardLabelResolver(
  surfaceId: string
): WizardLabelResolverSurface | null {
  return getCache().get(surfaceId) ?? null;
}

/**
 * Warm + publish Denali label resolver under plugin id. Idempotent.
 * Invoked from `capabilities.labels.ensureReady` and wizardHost ensureReady.
 */
export async function ensureWizardLabelResolverPackageSurface(): Promise<WizardLabelResolverSurface> {
  const surfaceId = DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardLabelResolver(surfaceId);
  if (existing != null) {
    return existing;
  }
  const mod = await import("../ui/surfaces/field-label-resolver");
  const next = mod.createDenaliFieldLabelResolver() as WizardLabelResolverSurface;
  getCache().set(surfaceId, next);
  return next;
}
