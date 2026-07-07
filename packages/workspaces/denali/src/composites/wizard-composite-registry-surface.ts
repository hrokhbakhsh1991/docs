import { DENALI_COMPOSITE_BY_CANONICAL_PATH } from "./denali-composite-registry";

export type DenaliWizardCompositeRegistrySurface = {
  readonly compositeByCanonicalPath: typeof DENALI_COMPOSITE_BY_CANONICAL_PATH;
};

export const denaliWizardCompositeRegistrySurface: DenaliWizardCompositeRegistrySurface =
  Object.freeze({
    compositeByCanonicalPath: DENALI_COMPOSITE_BY_CANONICAL_PATH,
  });
