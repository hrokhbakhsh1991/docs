import type { z } from "zod";
import type { useTranslations } from "next-intl";

import {
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";

import { mapFormPathToCanonical } from "./rules/denaliRuleRequired";
import { findDenaliRuleField } from "./rules/denaliRuleModel";
import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { resolveDenaliRuleModelFromForm } from "./validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { mergeDenaliActiveSubmitIssues } from "./validation/denaliSubmitValidation";
import { getDenaliWizardSubmitIssues } from "./validation/denaliWizardFormZod";
import {
  getDenaliWizardPublishReadinessIssues,
  type DenaliWizardPublishReadinessIssue,
} from "./validation/denaliWizardPublishReadiness";
import {
  resolveDenaliRegistryFieldLabel,
  resolveDenaliRegistryStepId,
} from "./denaliRegistryFieldLabel";
import { resolvePublishReadinessFormPath } from "./publishReadinessPathResolver";
import type { DenaliUIContextOptions } from "./rules/denaliUIAdapter";

export type DenaliT = ReturnType<typeof useTranslations<"tours.denali">>;

export type DenaliWizardSubmitIssueView = {
  formPath: string;
  canonicalPath: string;
  label: string;
  message: string;
  stepId: DenaliCreateWizardStepId;
};

export type DenaliWizardSubmitIssuesByStep = {
  stepId: DenaliCreateWizardStepId;
  stepTitle: string;
  issues: DenaliWizardSubmitIssueView[];
};

function issuePathToFormPath(path: readonly (string | number)[]): string {
  return path.map(String).join(".");
}

export function resolveStepForIssue(
  formPath: string,
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet,
): DenaliCreateWizardStepId {
  if (formPath === "basicInfo.publishStatus") {
    return "review";
  }

  const fromRegistry = resolveDenaliRegistryStepId(formPath);
  if (fromRegistry != null && fromRegistry !== "review") {
    return fromRegistry;
  }

  const canonicalPath = mapFormPathToCanonical(formPath);
  const model = resolveDenaliRuleModelFromForm(form, ruleSet);
  const ruleField = model == null ? undefined : findDenaliRuleField(model, canonicalPath);
  if (ruleField?.step != null && ruleField.step !== "review") {
    return ruleField.step;
  }

  if (formPath.startsWith("basicInfo.")) return "denali_basic";
  if (formPath.startsWith("programNature.")) return "denali_program";
  if (formPath.startsWith("transport.")) return "denali_logistics";
  if (formPath.startsWith("tripDetails.")) return "denali_logistics";
  if (formPath.startsWith("policies.")) {
    return "denali_legal";
  }
  if (formPath.startsWith("participantRequirements.")) {
    return "denali_pricing";
  }
  if (formPath.startsWith("pricingPayment.")) return "denali_pricing";
  if (formPath.startsWith("photosData.")) return "denali_photos";

  return "denali_basic";
}

export function buildDenaliSubmitIssueViews(
  issues: readonly z.ZodIssue[],
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet,
  t: DenaliT,
): DenaliWizardSubmitIssueView[] {
  return issues.map((issue) => {
    const formPath = issuePathToFormPath(issue.path as (string | number)[]);
    const canonicalPath = mapFormPathToCanonical(formPath);
    const stepId = resolveStepForIssue(formPath, form, ruleSet);
    return {
      formPath,
      canonicalPath,
      label: resolveDenaliRegistryFieldLabel(formPath, t),
      message: issue.message,
      stepId,
    };
  });
}

export { resolvePublishReadinessFormPath };

export function buildDenaliPublishReadinessIssueViews(
  issues: readonly DenaliWizardPublishReadinessIssue[],
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet,
  t: DenaliT,
): DenaliWizardSubmitIssueView[] {
  return issues.map((issue) => {
    const formPath = resolvePublishReadinessFormPath(issue);
    const canonicalPath = formPath.length > 0 ? mapFormPathToCanonical(formPath) : "";
    const stepId =
      formPath.length > 0 ? resolveStepForIssue(formPath, form, ruleSet) : ("review" as const);
    return {
      formPath,
      canonicalPath,
      label: formPath.length > 0 ? resolveDenaliRegistryFieldLabel(formPath, t) : "",
      message: issue.message,
      stepId,
    };
  });
}

export function groupDenaliSubmitIssuesByStep(
  views: readonly DenaliWizardSubmitIssueView[],
  stepOrder: readonly DenaliCreateWizardStepId[],
): DenaliWizardSubmitIssuesByStep[] {
  const byStep = new Map<DenaliCreateWizardStepId, DenaliWizardSubmitIssueView[]>();

  for (const view of views) {
    if (view.stepId === "review") continue;
    const bucket = byStep.get(view.stepId) ?? [];
    bucket.push(view);
    byStep.set(view.stepId, bucket);
  }

  return stepOrder
    .filter((stepId) => stepId !== "review" && (byStep.get(stepId)?.length ?? 0) > 0)
    .map((stepId) => ({
      stepId,
      stepTitle: getDenaliStepTitleFa(stepId),
      issues: byStep.get(stepId) ?? [],
    }));
}

export function collectDenaliWizardSubmitIssuePresentation(input: {
  form: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  stepOrder: readonly DenaliCreateWizardStepId[];
  t: DenaliT;
  uiOptions?: DenaliUIContextOptions;
}): {
  views: DenaliWizardSubmitIssueView[];
  byStep: DenaliWizardSubmitIssuesByStep[];
} {
  const submitIssues = getDenaliWizardSubmitIssues(input.form, input.uiOptions, input.ruleSet);
  const publishIssues =
    (input.form.basicInfo.publishStatus ?? "draft") === "active"
      ? getDenaliWizardPublishReadinessIssues(input.form, "denali_pilot", input.ruleSet)
      : [];
  const issues = mergeDenaliActiveSubmitIssues(submitIssues, publishIssues);
  const views = buildDenaliSubmitIssueViews(issues, input.form, input.ruleSet, input.t);
  return {
    views,
    byStep: groupDenaliSubmitIssuesByStep(views, input.stepOrder),
  };
}
