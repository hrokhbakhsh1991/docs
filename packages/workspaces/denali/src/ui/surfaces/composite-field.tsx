"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import type { ReactNode } from "react";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-rule-eval-context";
import { resolveDenaliCompositeRenderer } from "./composite-renderers";

type DenaliCompositeFieldProps = {
  readonly compositeId: string;
  readonly field: RenderFieldPlan;
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
  readonly wizardRuleEvalContext?: Pick<DenaliWizardRuleEvalContext, "ruleSet">;
  readonly invalid?: boolean;
  readonly validationIssuePaths?: readonly string[];
};

export function DenaliCompositeField({
  compositeId,
  field,
  draft,
  onDraftChange,
  wizardSessionId,
  workspaceFormProfile,
  wizardRuleEvalContext,
  invalid = false,
  validationIssuePaths,
}: DenaliCompositeFieldProps): ReactNode {
  const renderer = resolveDenaliCompositeRenderer(compositeId);
  if (!renderer) {
    return null;
  }
  return renderer({
    field,
    draft,
    onDraftChange,
    wizardSessionId,
    workspaceFormProfile,
    wizardRuleEvalContext,
    invalid,
    validationIssuePaths,
  });
}
