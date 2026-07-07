export type CreateClubWizardStep = 1 | 2 | 3 | 4;

export type CreateClubDraft = {
  displayName: string;
  subdomain: string;
  workspaceType: string;
  ownerPhone: string;
  ownerNameNote: string;
};

export type WorkspaceOption = {
  readonly id: string;
  readonly displayName?: string;
  readonly productionTier?: "stub" | "certified";
  readonly productionOnboardingAllowed?: boolean;
};

export function createInitialCreateClubDraft(): CreateClubDraft {
  return {
    displayName: "",
    subdomain: "",
    workspaceType: "",
    ownerPhone: "",
    ownerNameNote: "",
  };
}

export function initialCreateClubWizardStep(): CreateClubWizardStep {
  return 1;
}

export function nextCreateClubWizardStep(step: CreateClubWizardStep): CreateClubWizardStep {
  return step >= 4 ? 4 : ((step + 1) as CreateClubWizardStep);
}

export function previousCreateClubWizardStep(step: CreateClubWizardStep): CreateClubWizardStep {
  return step <= 1 ? 1 : ((step - 1) as CreateClubWizardStep);
}

export function buildCreateClubSuccessPath(tenantId: string): string {
  return `/platform/clubs/${tenantId}`;
}
