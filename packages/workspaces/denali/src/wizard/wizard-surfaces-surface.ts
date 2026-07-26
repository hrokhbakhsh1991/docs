/**
 * Thin Shell Phase 4as / 4bl — package-owned wizard composite/review surface registry.
 * String-keyed dynamic import keeps plugin/wizard tsc free of static `src/ui`.
 * Phase 4bl: publish key = `DENALI_WORKSPACE_PLUGIN_ID`.
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

export const WIZARD_COMPOSITE_SURFACE_CACHE_KEY = "app-cloud.wizardCompositeSurfaceCache";
export const WIZARD_REVIEW_SURFACE_CACHE_KEY = "app-cloud.wizardReviewSurfaceCache";

type WizardCompositeSurface = {
  readonly renderCompositeField: (props: never) => unknown;
};

type WizardReviewSurface = {
  readonly computeCompletion?: (...args: never[]) => unknown;
  readonly renderCompletionHeader?: (...args: never[]) => unknown;
  readonly renderValidationSummary?: (...args: never[]) => unknown;
  readonly renderReviewChrome?: (...args: never[]) => unknown;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_COMPOSITE_SURFACE_CACHE_KEY]?: Map<string, WizardCompositeSurface>;
  [WIZARD_REVIEW_SURFACE_CACHE_KEY]?: Map<string, WizardReviewSurface>;
};

function getCompositeCache(): Map<string, WizardCompositeSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_COMPOSITE_SURFACE_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[WIZARD_COMPOSITE_SURFACE_CACHE_KEY] = cache;
  }
  return cache;
}

function getReviewCache(): Map<string, WizardReviewSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_REVIEW_SURFACE_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[WIZARD_REVIEW_SURFACE_CACHE_KEY] = cache;
  }
  return cache;
}

export function peekWizardCompositeSurface(surfaceId: string): WizardCompositeSurface | null {
  return getCompositeCache().get(surfaceId) ?? null;
}

export function peekWizardReviewSurface(surfaceId: string): WizardReviewSurface | null {
  return getReviewCache().get(surfaceId) ?? null;
}

/**
 * Warm + publish Denali composite + review under surface id matching plugin id.
 * Idempotent. Invoked from `capabilities.wizardSurfaces.ensureReady` and wizardHost.
 */
export async function ensureWizardSurfacesPackageSurface(): Promise<void> {
  const surfaceId = DENALI_WORKSPACE_PLUGIN_ID;
  const compositeExisting = peekWizardCompositeSurface(surfaceId);
  const reviewExisting = peekWizardReviewSurface(surfaceId);
  if (compositeExisting != null && reviewExisting != null) {
    return;
  }

  const compositeSpecifier = "../ui/surfaces/composite-surface";
  const reviewSpecifier = "../ui/surfaces/review-surface";
  const [compositeMod, reviewMod] = await Promise.all([
    import(compositeSpecifier),
    import(reviewSpecifier),
  ]);
  if (compositeExisting == null) {
    getCompositeCache().set(
      surfaceId,
      compositeMod.createDenaliCompositeSurface() as WizardCompositeSurface
    );
  }
  if (reviewExisting == null) {
    getReviewCache().set(
      surfaceId,
      reviewMod.createDenaliReviewSurface() as WizardReviewSurface
    );
  }
}
