/**
 * Denali wizard RHF form model (types, defaults, normalize).
 * Submit validation: {@link ./denaliCanonicalTourSchema.unified.ts} only — not {@link ./denaliTourCreateBaseSchema.ts}.
 */

export type { DenaliCreateTourWizardForm } from "./denaliTourCreateBaseSchema";

export {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
} from "./denaliTourCreateBaseSchema";

export {
  normalizeDenaliFormPatch,
  normalizeDenaliWizardForm,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
