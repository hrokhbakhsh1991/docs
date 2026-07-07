import type { CreateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";
import { mapValidationResultToIssues, type ValidationIssue } from "@app-tour/wizard-navigation";
import { validateDenaliCreateTourSubmitSync } from "../../wizard/denali-wizard-validation";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-submit-payload";
import { buildFieldStepResolverFromTemplate } from "../../wizard/build-field-step-resolver";
import { submitDenaliCreateTour } from "./tour-create-payload";

export type DenaliWizardTemplateStepsForValidation = readonly {
  readonly stepId: string;
  readonly enabled?: boolean;
  readonly fields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[];
}[];

export type DenaliCreateTourSubmitFailure = {
  readonly kind: "rules-not-ready" | "validation" | "submit-config" | "create-action";
  readonly code: string;
  readonly status?: number;
  readonly validationIssues?: readonly ValidationIssue[];
};

export type DenaliCreateTourSubmitSuccess = {
  readonly payload: CreateTourPayload;
};

/** Phase 15.2 P15-W-B1e / P15-W-C1 — validate + build payload for Denali create wizard. */
export async function runDenaliCreateTourSubmit(input: {
  readonly plugin: WorkspacePlugin;
  readonly draft: DenaliTourWizardDraft;
  readonly denaliRules: DenaliWizardRulesModule | null;
  readonly wizardRuleEvalContext: DenaliWizardRuleEvalContext | undefined;
  readonly tenantId: string;
  readonly gate: { readonly templateSteps: DenaliWizardTemplateStepsForValidation };
}): Promise<
  | { readonly ok: true; readonly result: DenaliCreateTourSubmitSuccess }
  | { readonly ok: false; readonly failure: DenaliCreateTourSubmitFailure }
> {
  if (input.denaliRules == null) {
    return {
      ok: false,
      failure: { kind: "rules-not-ready", code: "DENALI_RULES_NOT_READY" },
    };
  }

  const validationResult = validateDenaliCreateTourSubmitSync({
    plugin: input.plugin,
    draft: input.draft as unknown as Record<string, unknown>,
    rulesModule: input.denaliRules as DenaliWizardRulesModule,
    tenantId: input.tenantId,
    evalContext: input.wizardRuleEvalContext,
  });

  if (validationResult.kind === "rules-not-ready") {
    return {
      ok: false,
      failure: { kind: "rules-not-ready", code: "DENALI_RULES_NOT_READY" },
    };
  }

  if (!validationResult.validation.ok) {
    const resolveStepId = buildFieldStepResolverFromTemplate(input.gate.templateSteps);
    return {
      ok: false,
      failure: {
        kind: "validation",
        code: "VALIDATION_FAILED",
        validationIssues: mapValidationResultToIssues(validationResult.validation, {
          resolveStepId,
        }),
      },
    };
  }

  try {
    const payload = await submitDenaliCreateTour({
      plugin: input.plugin,
      draft: input.draft,
      rules: input.denaliRules as DenaliWizardRulesModule,
      evalContext: input.wizardRuleEvalContext!,
    });
    return { ok: true, result: { payload } };
  } catch (error: unknown) {
    return {
      ok: false,
      failure: {
        kind: "submit-config",
        code: error instanceof Error ? error.message : "WIZARD_SUBMIT_NOT_CONFIGURED",
      },
    };
  }
}
