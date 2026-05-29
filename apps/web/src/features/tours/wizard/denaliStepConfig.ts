/**
 * Denali MVP create wizard — step ids from domain; localized titles stay in apps/web.
 */
export {
  denaliWizardSteps,
  getDenaliWizardSteps,
  type DenaliCreateWizardStepId,
} from "@repo/denali-domain";

export const DENALI_MVP_REMOVED_STEPS = [
  {
    id: "denali_participants" as const,
    reason:
      "Participant requirements (age, fitness, gear, insurance) removed from wizard flow; values remain at form defaults until schema/MVP domain cutover.",
  },
  {
    id: "denali_policies" as const,
    reason:
      "Separate policies step removed; optional policies textarea on review writes `policies.cancellationPolicy` for MVP.",
  },
  {
    id: "denali_transport" as const,
    reason: "Renamed to denali_logistics in Phase 16.15.",
  },
] as const;

export const denaliStepTitlesFa: Record<
  import("@repo/denali-domain").DenaliCreateWizardStepId,
  string
> = {
  denali_basic: "اطلاعات پایه",
  denali_program: "برنامه",
  denali_logistics: "لجستیک و خدمات",
  denali_pricing: "هزینه",
  denali_legal: "قوانین و شرایط",
  denali_photos: "عکس‌ها",
  review: "بازبینی و ثبت",
};

export function getDenaliStepTitleFa(
  stepId: import("@repo/denali-domain").DenaliCreateWizardStepId,
): string {
  return denaliStepTitlesFa[stepId];
}
