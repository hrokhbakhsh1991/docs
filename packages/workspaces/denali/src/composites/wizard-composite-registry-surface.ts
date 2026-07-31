import { DENALI_COMPOSITE_BY_CANONICAL_PATH } from "./denali-composite-registry";

/**
 * Manifest-bound composite registry surface.
 * PSR-4b-exports-2: also hosts form-profile ghost paths so `./host/composites` can peel.
 */
export { DENALI_FORM_PROFILE_GHOST_PATHS } from "./denali-composite-anchors";

export type DenaliWizardCompositeRegistrySurface = {
  readonly compositeByCanonicalPath: typeof DENALI_COMPOSITE_BY_CANONICAL_PATH;
};

export const denaliWizardCompositeRegistrySurface: DenaliWizardCompositeRegistrySurface =
  Object.freeze({
    compositeByCanonicalPath: DENALI_COMPOSITE_BY_CANONICAL_PATH,
  });
