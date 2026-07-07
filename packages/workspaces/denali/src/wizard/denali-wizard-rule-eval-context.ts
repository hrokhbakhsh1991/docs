import { resolveDenaliRuleSetFromTemplate } from "../normalize/resolveRuleModel";

export const DENALI_DEFAULT_WORKSPACE_FORM_PROFILE = "denali_pilot" as const;

export function resolveDenaliWorkspaceFormProfile(
  workspaceFormProfile: string | undefined
): string {
  const trimmed = workspaceFormProfile?.trim();
  return trimmed != null && trimmed.length > 0 ? trimmed : DENALI_DEFAULT_WORKSPACE_FORM_PROFILE;
}

export type DenaliWizardRuleEvalContext = {
  readonly uiOptions: {
    readonly workspaceFormProfile: string;
    readonly mainThemeFormProfile?: string;
  };
  readonly ruleSet: ReturnType<typeof resolveDenaliRuleSetFromTemplate>;
};

export function buildDenaliWizardRuleEvalContext(input?: {
  readonly workspaceFormProfile?: string;
  readonly mainThemeFormProfile?: string;
  readonly fieldRulesOverlay?: Readonly<Record<string, unknown>>;
  readonly telegramIntegrationActive?: boolean;
}): DenaliWizardRuleEvalContext {
  const workspaceFormProfile = resolveDenaliWorkspaceFormProfile(input?.workspaceFormProfile);

  return {
    uiOptions: {
      workspaceFormProfile,
      ...(input?.mainThemeFormProfile ? { mainThemeFormProfile: input.mainThemeFormProfile } : {}),
      ...(input?.telegramIntegrationActive !== undefined
        ? { telegramIntegrationActive: input.telegramIntegrationActive }
        : {}),
    },
    ruleSet: resolveDenaliRuleSetFromTemplate({
      fieldRulesOverlay: input?.fieldRulesOverlay,
    }),
  };
}
