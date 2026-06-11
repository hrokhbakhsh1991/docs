"use client";

import type { ValidationIssue } from "@app-tour/wizard-navigation";
import { useTranslations } from "next-intl";

import {
  groupValidationIssuesByStep,
  type ValidationIssueStepGroup,
} from "./group-validation-issues-by-step";

export const DENALI_REVIEW_VALIDATION_TEST_IDS = {
  panel: "denali-review-validation-summary",
  stepGroup: "denali-validation-step-group",
  issueLink: "denali-validation-issue-link",
} as const;

type DenaliReviewValidationSummaryProps = {
  readonly issues: readonly ValidationIssue[];
  readonly steps: readonly { readonly stepId: string; readonly label: string }[];
  readonly onFocusIssue: (stepId: string, path: string) => void;
};

export function DenaliReviewValidationSummary({
  issues,
  steps,
  onFocusIssue,
}: DenaliReviewValidationSummaryProps) {
  const t = useTranslations("denali");
  if (issues.length === 0) {
    return null;
  }

  const groups: readonly ValidationIssueStepGroup[] = groupValidationIssuesByStep(issues, steps);

  return (
    <section
      className="denali-review-validation"
      role="alert"
      data-testid={DENALI_REVIEW_VALIDATION_TEST_IDS.panel}
    >
      <h3 className="denali-review-validation__heading">{t("review.validationHeading")}</h3>
      <div className="denali-review-validation__groups">
        {groups.map((group) => (
          <section
            key={group.stepId}
            className="denali-review-validation__group"
            data-testid={`${DENALI_REVIEW_VALIDATION_TEST_IDS.stepGroup}-${group.stepId}`}
          >
            <button
              type="button"
              className="denali-review-validation__group-title"
              onClick={() => {
                const first = group.issues[0];
                if (first != null) {
                  onFocusIssue(group.stepId, first.path);
                }
              }}
            >
              {t("review.validationStepGroup", {
                step: group.label,
                count: group.issues.length,
              })}
            </button>
            <ul className="denali-review-validation__issue-list">
              {group.issues.map((issue) => (
                <li key={`${issue.path}:${issue.message}`}>
                  <button
                    type="button"
                    className="denali-review-validation__issue-link"
                    data-testid={`${DENALI_REVIEW_VALIDATION_TEST_IDS.issueLink}-${issue.path.replace(/\./g, "-")}`}
                    onClick={() => onFocusIssue(group.stepId, issue.path)}
                  >
                    {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
