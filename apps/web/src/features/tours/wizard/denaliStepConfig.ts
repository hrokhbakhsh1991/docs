/**
 * Denali MVP create wizard — fixed 5-step rail (no dynamic skip, no profile branching).
 *
 * @see docs/architecture/denali-canonical-domain-model.md
 */
export const denaliWizardSteps = [
  "denali_basic",
  "denali_program",
  "denali_logistics",
  "denali_pricing",
  "denali_photos",
  "review",
] as const;

export type DenaliCreateWizardStepId = (typeof denaliWizardSteps)[number];

/**
 * Historical step ids removed from the 5-step rail (not in {@link DenaliRuleFieldStep}).
 * Mountain participants + optional policies notes: `denali_pricing` (`DenaliPricingParticipantSection`).
 * Review: display-only mirror (`DenaliReviewParticipantsDisplay`).
 */
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

export const denaliStepTitlesFa: Record<DenaliCreateWizardStepId, string> = {
  denali_basic: "اطلاعات پایه",
  denali_program: "برنامه",
  denali_logistics: "لجستیک و خدمات",
  denali_pricing: "هزینه",
  denali_photos: "عکس‌ها",
  review: "بازبینی و ثبت",
};

export function getDenaliWizardSteps(): readonly DenaliCreateWizardStepId[] {
  return denaliWizardSteps;
}

export function getDenaliStepTitleFa(stepId: DenaliCreateWizardStepId): string {
  return denaliStepTitlesFa[stepId];
}
