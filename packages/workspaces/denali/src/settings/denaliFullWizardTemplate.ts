/**
 * Published wizard template — legacy Denali parity field set.
 *
 * Intersection model: catalog ∩ this template ∩ rule matrix (category) ∩ contextual rules.
 * `category` must stay first so matrix + contextual rules apply at runtime.
 */

export type DenaliWizardTemplateFieldRef = {
  readonly canonicalPath: string;
  readonly required?: boolean;
};

export type DenaliWizardTemplateStepRef = {
  readonly stepId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly fields: readonly DenaliWizardTemplateFieldRef[];
};

export type DenaliFullWizardTemplatePayload = {
  readonly seedLabel: string;
  readonly published: true;
  readonly sections: readonly [];
  readonly steps: readonly DenaliWizardTemplateStepRef[];
};

const field = (canonicalPath: string, required?: boolean): DenaliWizardTemplateFieldRef => ({
  canonicalPath,
  ...(required === true ? { required: true } : {}),
});

/** All registry-backed fields for a legacy-like create-tour wizard (admin can trim later). */
export function buildDenaliFullWizardTemplateSteps(): readonly DenaliWizardTemplateStepRef[] {
  return [
    {
      stepId: "denali_basic",
      label: "اطلاعات پایه",
      enabled: true,
      fields: [
        field("category", true),
        field("title", true),
        field("destinationId", true),
        field("tripDetails.overview.peakHeight"),
        field("startDateTime", true),
        field("endDateTime"),
        field("approximateReturnTime"),
        field("capacityMax", true),
        field("capacityMin"),
        field("leaderUserIds"),
        field("requiresLocalGuide"),
        field("localGuideName"),
        field("requiresManualAdminApproval"),
        field("socialMediaLink"),
      ],
    },
    {
      stepId: "denali_photos",
      label: "عکس‌ها",
      enabled: true,
      fields: [
        field("program.themeIds"),
        field("photos"),
      ],
    },
    {
      stepId: "denali_program",
      label: "برنامه",
      enabled: true,
      fields: [
        field("program.guideLanguageIds"),
        field("program.difficultyLevel", true),
        field("program.hikingHoursApprox", true),
        field("program.hikingGoHours"),
        field("program.hikingReturnHours"),
        field("tripDetails.metrics.elevationGain"),
        field("program.itinerary"),
      ],
    },
    {
      stepId: "denali_logistics",
      label: "لجستیک و خدمات",
      enabled: true,
      fields: [
        field("transport.mode", true),
        field("gatheringPoints"),
        field("startPoint"),
        field("participants.gearItems"),
        field("tripDetails.logistics.includedServices"),
        field("tripDetails.overview.customServiceLabels"),
      ],
    },
    {
      stepId: "denali_pricing",
      label: "هزینه",
      enabled: true,
      fields: [
        field("pricing.requiresPayment"),
        field("participants.minimumAge", true),
        field("participants.minRequiredPeaks"),
        field("participants.nationalIdRequired"),
      ],
    },
    {
      stepId: "denali_legal",
      label: "قوانین و شرایط",
      enabled: true,
      fields: [
        field("policies.policiesText"),
        field("policies.cancellationDeadlineHours"),
        field("policies.cancellationPenaltyPercentage"),
      ],
    },
    {
      stepId: "review",
      label: "بازبینی و ثبت",
      enabled: true,
      fields: [field("publishStatus", true)],
    },
  ];
}

export function buildDenaliFullWizardTemplatePayload(
  seedLabel = "تور جدید"
): DenaliFullWizardTemplatePayload {
  return {
    seedLabel,
    published: true,
    sections: [],
    steps: buildDenaliFullWizardTemplateSteps(),
  };
}

/** Tenant PUT payload — omits Layer C `review` / `publishStatus` (INV-WIZ-002 palette). */
export function buildDenaliTenantWizardTemplatePayload(
  seedLabel = "تور جدید"
): DenaliFullWizardTemplatePayload {
  const payload = buildDenaliFullWizardTemplatePayload(seedLabel);
  return {
    ...payload,
    steps: payload.steps.filter((step) => step.stepId !== "review"),
  };
}
