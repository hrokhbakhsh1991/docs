import { resolveDenaliRuleSetFromTemplate } from "../normalize/resolveRuleModel";

export const DENALI_DEFAULT_WORKSPACE_FORM_PROFILE = "denali_pilot" as const;

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
}): DenaliWizardRuleEvalContext {
  const workspaceFormProfile =
    input?.workspaceFormProfile?.trim() || DENALI_DEFAULT_WORKSPACE_FORM_PROFILE;

  return {
    uiOptions: {
      workspaceFormProfile,
      ...(input?.mainThemeFormProfile ? { mainThemeFormProfile: input.mainThemeFormProfile } : {}),
    },
    ruleSet: resolveDenaliRuleSetFromTemplate({
      fieldRulesOverlay: input?.fieldRulesOverlay,
    }),
  };
}
