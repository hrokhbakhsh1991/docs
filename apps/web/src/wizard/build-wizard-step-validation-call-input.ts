/**
 * INV-DENALI-WIZ-014 — Continue step-nav validate input must carry the same
 * rule-eval context the host already built for contextual plan + review.
 */
export type WizardStepValidationCallInput = {
  readonly plugin: unknown;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly tenantId: string;
  readonly stepId: string;
  readonly visibleSteps: readonly unknown[];
  readonly evalContext: unknown;
};

export function buildWizardStepValidationCallInput(
  input: WizardStepValidationCallInput
): {
  readonly plugin: unknown;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly tenantId: string;
  readonly evalContext: unknown;
  readonly scope: {
    readonly stepId: string;
    readonly visibleSteps: readonly unknown[];
  };
} {
  return {
    plugin: input.plugin,
    draft: input.draft,
    rulesModule: input.rulesModule,
    tenantId: input.tenantId,
    evalContext: input.evalContext,
    scope: {
      stepId: input.stepId,
      visibleSteps: input.visibleSteps,
    },
  };
}
