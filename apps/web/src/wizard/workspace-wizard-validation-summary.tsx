"use client";

import type { ValidationIssue } from "@app-tour/wizard-navigation";
import { useTranslations } from "next-intl";

import { groupValidationIssuesByStep } from "./group-validation-issues-by-step";
import { resolveWizardValidationIssueMessage } from "./resolve-wizard-validation-issue-message";
import type { WizardStepDescriptor } from "./wizard-surface-types";
import { resolveWizardValidationFieldLabel } from "./wizard-validation-field-label";

export const WORKSPACE_WIZARD_VALIDATION_TEST_IDS = {
  panel: "workspace-wizard-validation-summary",
  issueLink: "workspace-wizard-validation-issue-link",
} as const;

type WorkspaceWizardValidationSummaryProps = {
  readonly issues: readonly ValidationIssue[];
  readonly stepDescriptors: readonly WizardStepDescriptor[];
  readonly onFocusIssue: (stepId: string, path: string) => void;
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
};

/** Platform-default validation panel — workspace-agnostic (Urban/Starter). */
export function WorkspaceWizardValidationSummary({
  issues,
  stepDescriptors,
  onFocusIssue,
  fieldLabelSurfaceId,
  translateWorkspaceMessage,
}: WorkspaceWizardValidationSummaryProps) {
  const t = useTranslations("wizard.host.validation");
  const tCodes = useTranslations("wizard.host.validation.codes");
  if (issues.length === 0) {
    return null;
  }

  const validationTranslator = {
    has: (key: string) => tCodes.has(key),
    translate: (key: string, values: { field: string }) => tCodes(key, values),
  };

  const groups = groupValidationIssuesByStep(issues, stepDescriptors);

  return (
    <section
      className="workspace-wizard-validation"
      role="alert"
      aria-live="polite"
      data-testid={WORKSPACE_WIZARD_VALIDATION_TEST_IDS.panel}
    >
      <h3 className="workspace-wizard-validation__heading">{t("heading")}</h3>
      <p className="workspace-wizard-validation__count">{t("count", { count: issues.length })}</p>
      <div className="workspace-wizard-validation__groups">
        {groups.map((group) => (
          <section key={group.stepId} className="workspace-wizard-validation__group">
            <button
              type="button"
              className="workspace-wizard-validation__group-title"
              aria-label={t("goToStep", { step: group.label })}
              onClick={() => {
                const first = group.issues[0];
                if (first != null) {
                  onFocusIssue(group.stepId, first.path);
                }
              }}
            >
              {t("stepGroup", { step: group.label, count: group.issues.length })}
            </button>
            <ul className="workspace-wizard-validation__issue-list">
              {group.issues.map((issue) => {
                const fieldLabel = resolveWizardValidationFieldLabel({
                  canonicalPath: issue.path,
                  fieldLabelSurfaceId,
                  translateWorkspaceMessage,
                });
                const issueMessage = resolveWizardValidationIssueMessage(
                  issue,
                  validationTranslator,
                  fieldLabel
                );
                return (
                  <li key={`${issue.path}:${issue.code ?? issue.message}`}>
                    <button
                      type="button"
                      className="workspace-wizard-validation__issue-link"
                      data-testid={`${WORKSPACE_WIZARD_VALIDATION_TEST_IDS.issueLink}-${issue.path.replace(/\./g, "-")}`}
                      aria-label={t("issueAction", { field: fieldLabel })}
                      onClick={() => onFocusIssue(group.stepId, issue.path)}
                    >
                      <span className="workspace-wizard-validation__issue-field">{fieldLabel}</span>
                      <span className="workspace-wizard-validation__issue-message">{issueMessage}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
