import type { TourFormProfile } from "@repo/types";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

export type TenantWizardStepOverrides = {
  readonly skip: readonly DenaliCreateWizardStepId[];
  readonly insert: readonly DenaliCreateWizardStepId[];
};

export type TenantWizardTemplate = {
  readonly id: string;
  readonly workspaceId: string;
  readonly baseProfile: TourFormProfile;
  readonly stepOverrides: TenantWizardStepOverrides;
  readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
  readonly presetId: string | null;
  readonly canonicalData: Readonly<Record<string, unknown>>;
  readonly wizardContractVersion: number;
  readonly formProfileVersion: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type TenantWizardTemplateEnvelope = {
  readonly template: TenantWizardTemplate | null;
};
