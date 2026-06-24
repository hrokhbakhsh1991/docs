import type { UpdateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";
import { mapValidationResultToIssues, type ValidationIssue } from "@app-tour/wizard-navigation";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliSubmitCatalogIds } from "../../wizard/denali-wizard-catalog-sanitize";
import type { DenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-submit-payload";
import {
  buildFieldStepResolverFromTemplate,
  validateDenaliPublishTransitionSync,
  validateDenaliWizardDraftSync,
} from "./wizard-validation";

export type DenaliFlatEditPatchIntent = "save" | "publish" | "unpublish";

export type DenaliFlatEditPatchFailure = {
  readonly kind: "not-ready" | "validation" | "patch-config" | "update-action";
  readonly code: string;
  readonly status?: number;
  readonly message?: string;
  readonly validationIssues?: readonly ValidationIssue[];
};

export type DenaliFlatEditTemplateStepsForPatch = readonly {
  readonly stepId: string;
  readonly enabled?: boolean;
  readonly fields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[];
}[];

/** Phase 12.4 — validate + build patch payload for Denali flat edit. */
export async function runDenaliFlatEditPatch(input: {
  readonly plugin: WorkspacePlugin;
  readonly draft: DenaliTourWizardDraft;
  readonly denaliRules: DenaliWizardRulesModule | null;
  readonly wizardRuleEvalContext: DenaliWizardRuleEvalContext | undefined;
  readonly tenantId: string;
  readonly rowVersion: number | null;
  readonly patchIntent: DenaliFlatEditPatchIntent;
  readonly gate: { readonly templateSteps: DenaliFlatEditTemplateStepsForPatch };
  readonly loadCatalog: () => Promise<DenaliSubmitCatalogIds>;
  readonly updateTour: (
    payload: UpdateTourPayload
  ) => Promise<
    | { readonly ok: true; readonly rowVersion: number }
    | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string }
  >;
}): Promise<
  | { readonly ok: true; readonly rowVersion: number; readonly patchIntent: DenaliFlatEditPatchIntent }
  | { readonly ok: false; readonly failure: DenaliFlatEditPatchFailure }
> {
  if (input.denaliRules == null || input.rowVersion == null) {
    return {
      ok: false,
      failure: { kind: "not-ready", code: "TOUR_EDIT_NOT_READY" },
    };
  }

  if (input.patchIntent === "publish" && input.wizardRuleEvalContext == null) {
    return {
      ok: false,
      failure: { kind: "not-ready", code: "DENALI_EVAL_CONTEXT_NOT_READY" },
    };
  }

  const validation =
    input.patchIntent === "publish"
      ? validateDenaliPublishTransitionSync(
          input.plugin,
          input.draft,
          input.denaliRules,
          input.tenantId,
          input.wizardRuleEvalContext!
        )
      : validateDenaliWizardDraftSync(
          input.plugin,
          input.draft,
          input.denaliRules,
          input.tenantId
        );

  if (!validation.ok) {
    const resolveStepId = buildFieldStepResolverFromTemplate(input.gate.templateSteps);
    return {
      ok: false,
      failure: {
        kind: "validation",
        code: "VALIDATION_FAILED",
        validationIssues: mapValidationResultToIssues(validation, { resolveStepId }),
      },
    };
  }

  const catalog = await input.loadCatalog();
  const preparePatch = input.plugin.wizardHost?.prepareTourPatchPayload;
  if (preparePatch == null) {
    return {
      ok: false,
      failure: { kind: "patch-config", code: "WIZARD_PATCH_NOT_CONFIGURED" },
    };
  }

  const payload = preparePatch({
    plugin: input.plugin,
    draft: input.draft as unknown as Record<string, unknown>,
    rulesModule: input.denaliRules,
    evalContext: input.wizardRuleEvalContext,
    rowVersion: input.rowVersion,
    patchIntent: input.patchIntent,
    catalog,
  }) as UpdateTourPayload;

  const result = await input.updateTour(payload);
  if (!result.ok) {
    return {
      ok: false,
      failure: {
        kind: "update-action",
        code: result.code,
        status: result.status,
        message: result.message,
      },
    };
  }

  return {
    ok: true,
    rowVersion: result.rowVersion,
    patchIntent: input.patchIntent,
  };
}
