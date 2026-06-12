import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { normalizeDenaliWizardForm } from "../normalize/clearHiddenFormValues";
import { resolveDenaliRuleModelFromForm } from "../normalize/resolveRuleModel";
import {
  collectDenaliRuleRequiredIssues,
  type DenaliRuleRequiredIssue,
} from "../rules/denaliRuleRequired";
import type { DenaliRuleSet } from "../rules/denaliRuleModel.types";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import type { DenaliUIContextOptions } from "../rules/denaliContextualRules";

import type { DenaliWizardPublishReadinessIssue } from "./publishReadinessTypes";

export type CollectDenaliPublishReadinessOptions = {
  readonly uiOptions?: DenaliUIContextOptions;
  /** Flat edit Publish — run matrix even when form publishStatus is still draft. */
  readonly publishTransition?: boolean;
};

function ruleRequiredIssueToPublishIssue(
  issue: DenaliRuleRequiredIssue
): DenaliWizardPublishReadinessIssue {
  return {
    code: "VALIDATION_RULE_REQUIRED_FIELD",
    message: issue.message,
    path: issue.path.join("."),
  };
}

/** Rule-engine publish blockers only (no API geo / DTO projection). */
export function collectDenaliPublishReadinessRuleIssues(
  rawForm: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
  options?: CollectDenaliPublishReadinessOptions
): DenaliWizardPublishReadinessIssue[] {
  if (!options?.publishTransition && rawForm.basicInfo.publishStatus !== "active") {
    return [];
  }

  const form = normalizeDenaliWizardForm(rawForm, options?.uiOptions, ruleSet);
  const model = resolveDenaliRuleModelFromForm(form, ruleSet);
  if (model == null) {
    return [
      {
        code: "DENALI_TOUR_TYPE_REQUIRED",
        message: "نوع تور را انتخاب کنید.",
        path: "basicInfo.tourType",
      },
    ];
  }

  return collectDenaliRuleRequiredIssues(form, model, { mode: "submit" }, options?.uiOptions).map(
    ruleRequiredIssueToPublishIssue
  );
}
