/**
 * Thin Shell Phase 4as / 4bl — package-owned wizard composite/review surface registry.
 * String-keyed dynamic import keeps plugin/wizard tsc free of static `src/ui`.
 * Phase 4bl: publish key = `DENALI_WORKSPACE_PLUGIN_ID`.
 *
 * Create warm owns composite only; review loads on demand (review step / capability ensureReady).
 * @see docs/dev/wizard-create-warm-ownership.mdoc
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";
import { importUiSurface } from "./import-ui-surface";

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
 * Warm + publish Denali composite under surface id matching plugin id.
 * Create `wizardHost.ensureReady` path — does not import review UI.
 */
export async function ensureWizardCompositePackageSurface(): Promise<WizardCompositeSurface> {
  const surfaceId = DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardCompositeSurface(surfaceId);
  if (existing != null) {
    return existing;
  }
  const compositeMod = await importUiSurface("../ui/surfaces/composite-surface");
  const surface = compositeMod.createDenaliCompositeSurface() as WizardCompositeSurface;
  getCompositeCache().set(surfaceId, surface);
  return surface;
}

/**
 * Warm + publish Denali review under surface id matching plugin id.
 * Invoked on demand when the review step is reached (via capability ensureReady).
 */
export async function ensureWizardReviewPackageSurface(): Promise<WizardReviewSurface> {
  const surfaceId = DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardReviewSurface(surfaceId);
  if (existing != null) {
    return existing;
  }
  const reviewMod = await importUiSurface("../ui/surfaces/review-surface");
  const surface = reviewMod.createDenaliReviewSurface() as WizardReviewSurface;
  getReviewCache().set(surfaceId, surface);
  return surface;
}

/**
 * Warm + publish Denali composite + review under surface id matching plugin id.
 * Idempotent. Invoked from `capabilities.wizardSurfaces.ensureReady` (TS-4AS-04).
 */
export async function ensureWizardSurfacesPackageSurface(): Promise<void> {
  await Promise.all([
    ensureWizardCompositePackageSurface(),
    ensureWizardReviewPackageSurface(),
  ]);
}
