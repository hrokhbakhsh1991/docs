/**
 * Denali wizard RHF form model (types, defaults, normalize).
 * Submit validation: {@link ./denaliCanonicalTourSchema.unified.ts} only — not {@link ./denaliTourCreateBaseSchema.ts}.
 */

export type { DenaliCreateTourWizardForm } from "./denaliCore.schema";

export {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
} from "./denaliCore.schema";

export {
  normalizeDenaliFormPatch,
  normalizeDenaliWizardForm,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";

/** Deep-merge partial wizard values onto defaults (clone/edit/preset helpers). */
export function mergeDenaliFormDefaults(
  defaults: import("./denaliCore.schema").DenaliCreateTourWizardForm,
  patch: Partial<import("./denaliCore.schema").DenaliCreateTourWizardForm>,
): import("./denaliCore.schema").DenaliCreateTourWizardForm {
  return {
    ...defaults,
    ...patch,
    basicInfo: { ...defaults.basicInfo, ...patch.basicInfo },
    programNature: { ...defaults.programNature, ...patch.programNature },
    transport: { ...defaults.transport, ...patch.transport },
    pricingPayment: { ...defaults.pricingPayment, ...patch.pricingPayment },
    participantRequirements: {
      ...defaults.participantRequirements,
      ...patch.participantRequirements,
    },
    policies: { ...defaults.policies, ...patch.policies },
    photosData: { ...defaults.photosData, ...patch.photosData },
    tripDetails: {
      ...defaults.tripDetails,
      ...patch.tripDetails,
      logistics: {
        ...defaults.tripDetails.logistics,
        ...patch.tripDetails?.logistics,
      },
    },
  };
}
