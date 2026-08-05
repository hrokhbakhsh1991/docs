"use client";

import type { ValidationIssue, WizardValidationHeadingKey } from "@app-tour/wizard-navigation";
import { resolveWizardValidationHeadingKey } from "@app-tour/wizard-navigation";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { groupValidationIssuesByStep } from "../adapters/group-validation-issues-by-step";
import { resolveWizardValidationIssueMessage } from "../adapters/resolve-wizard-validation-issue-message";
import { resolveDenaliWizardValidationFieldLabel } from "../adapters/wizard-validation-field-label";
import type { WizardStepDescriptor } from "../surfaces/wizard-surface-types";
import { DENALI_REVIEW_VALIDATION_TEST_IDS } from "../test-ids/denali-review-test-ids";

export { DENALI_REVIEW_VALIDATION_TEST_IDS } from "../test-ids/denali-review-test-ids";

type DenaliReviewValidationSummaryProps = {
  readonly issues: readonly ValidationIssue[];
  readonly stepDescriptors: readonly WizardStepDescriptor[];
  readonly onFocusIssue: (stepId: string, path: string) => void;
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
  readonly validationHeadingKey?: WizardValidationHeadingKey;
};

export function DenaliReviewValidationSummary({
  issues,
  stepDescriptors,
  onFocusIssue,
  translateWorkspaceMessage,
  validationHeadingKey,
}: DenaliReviewValidationSummaryProps) {
  const t = useTranslations("denali");
  const tValidation = useTranslations("denali.review.validation");
  const locale = useLocale();
  const isRtl = locale === "fa";
  const StepChevron = isRtl ? ChevronLeft : ChevronRight;
  const headingKey = resolveWizardValidationHeadingKey(validationHeadingKey);
  const translateFieldLabel =
    translateWorkspaceMessage ?? ((key: string) => t(key));
  const validationTranslator = {
    has: (key: string) => tValidation.has(key),
    translate: (key: string, values: { field: string }) => tValidation(key, values),
    translateWorkspace: (
      key: string,
      values?: Record<string, string | number>
    ) => t(key, values),
  };

  if (issues.length === 0) {
    return null;
  }

  const groups = groupValidationIssuesByStep(issues, stepDescriptors);

  return (
    <section
      className="operator-review-validation"
      role="alert"
      aria-live="polite"
      data-testid={DENALI_REVIEW_VALIDATION_TEST_IDS.panel}
      data-validation-heading={headingKey}
    >
      <header className="operator-review-validation__header">
        <span className="operator-review-validation__icon" aria-hidden="true">
          <AlertCircle size={20} strokeWidth={2.25} />
        </span>
        <div className="operator-review-validation__header-text">
          <h3 className="operator-review-validation__heading">{t(headingKey)}</h3>
          <p className="operator-review-validation__count">
            {t("review.validationCount", { count: issues.length })}
          </p>
        </div>
      </header>
      <div className="operator-review-validation__groups">
        {groups.map((group) => (
          <section
            key={group.stepId}
            className="operator-review-validation__group"
            data-testid={`${DENALI_REVIEW_VALIDATION_TEST_IDS.stepGroup}-${group.stepId}`}
          >
            <button
              type="button"
              className="operator-review-validation__group-title"
              aria-label={t("review.validationGoToStep", { step: group.label })}
              onClick={() => {
                const first = group.issues[0];
                if (first != null) {
                  onFocusIssue(group.stepId, first.path);
                }
              }}
            >
              <span className="operator-review-validation__group-label">
                {t("review.validationStepGroup", {
                  step: group.label,
                  count: group.issues.length,
                })}
              </span>
              <StepChevron className="operator-review-validation__group-chevron" aria-hidden="true" />
            </button>
            <ul className="operator-review-validation__issue-list">
              {group.issues.map((issue) => {
                const fieldLabel = resolveDenaliWizardValidationFieldLabel({
                  canonicalPath: issue.path,
                  translateWorkspaceMessage: translateFieldLabel,
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
                      className="operator-review-validation__issue-link"
                      data-testid={`${DENALI_REVIEW_VALIDATION_TEST_IDS.issueLink}-${issue.path.replace(/\./g, "-")}`}
                      aria-label={t("review.validationIssueAction", { field: fieldLabel })}
                      onClick={() => onFocusIssue(group.stepId, issue.path)}
                    >
                      <span className="operator-review-validation__issue-field">{fieldLabel}</span>
                      <span className="operator-review-validation__issue-message">{issueMessage}</span>
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
