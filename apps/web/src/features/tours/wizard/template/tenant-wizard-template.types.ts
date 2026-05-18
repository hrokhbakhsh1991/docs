import type { TourFormProfile } from "@repo/types";

import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

export type TenantWizardStepOverrides = {
  readonly skip: readonly TourCreateWizardStepId[];
  readonly insert: readonly TourCreateWizardStepId[];
};

export type TenantWizardTemplate = {
  readonly id: string;
  readonly workspaceId: string;
  readonly baseProfile: TourFormProfile;
  readonly stepOverrides: TenantWizardStepOverrides;
  readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
  readonly presetId: string | null;
  readonly wizardContractVersion: number;
  readonly formProfileVersion: number;
};

export type TenantWizardTemplateEnvelope = {
  readonly template: TenantWizardTemplate | null;
};
