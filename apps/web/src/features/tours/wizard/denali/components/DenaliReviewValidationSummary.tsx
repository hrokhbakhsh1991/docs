"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

import { getDenaliWizardVisibleSteps, useDenaliCanonical, useDenaliWizardFormSnapshot } from "../application";

import { useDenaliWizardNavigationOptional } from "../DenaliWizardNavigationContext";
import {
  buildDenaliPublishReadinessIssueViews,
  buildDenaliSubmitIssueViews,
  groupDenaliSubmitIssuesByStep,
  type DenaliWizardSubmitIssuesByStep,
} from "../denaliWizardSubmitIssuePresentation";
import type { DenaliSubmitErrorFocusHandler } from "../validation/denaliSubmitValidation";
import { getDenaliWizardSubmitIssues } from "../validation/denaliWizardFormZod";
import {
  getDenaliWizardPublishReadinessIssuesForTargetStatus,
  type DenaliWizardPublishReadinessIssue,
} from "../validation/denaliWizardPublishReadiness";
import { useWizardErrorHydrator } from "./WizardErrorHydrator";

type DenaliReviewValidationSummaryProps = {
  /** When set, clicking an error jumps to the wizard step and focuses the field. */
  onFocusField?: DenaliSubmitErrorFocusHandler;
  /**
   * Publish-readiness blockers (evaluated as if targeting `active`).
   * Defaults to {@link getDenaliWizardPublishReadinessIssuesForTargetStatus}.
   */
  publishIssues?: readonly DenaliWizardPublishReadinessIssue[];
};

function IssueListByStep({
  byStep,
  canFocusErrors,
  focusIssue,
  t,
  issueLinkTestIdPrefix,
}: {
  byStep: readonly DenaliWizardSubmitIssuesByStep[];
  canFocusErrors: boolean;
  focusIssue: (stepId: DenaliCreateWizardStepId, formPath: string) => void;
  t: ReturnType<typeof useTranslations<"tours.denali">>;
  issueLinkTestIdPrefix: string;
}) {
  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      {byStep.map((group) => (
        <section key={group.stepId} data-testid={`denali-validation-step-${group.stepId}`}>
          <button
            type="button"
            onClick={() => {
              const firstFocusable = group.issues.find((issue) => issue.formPath.length > 0);
              if (firstFocusable != null) {
                focusIssue(group.stepId, firstFocusable.formPath);
              }
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "start",
              padding: 0,
              border: "none",
              background: "transparent",
              color: "inherit",
              fontWeight: 600,
              cursor: canFocusErrors ? "pointer" : "default",
              textDecoration: canFocusErrors ? "underline" : "none",
            }}
            data-testid={`denali-validation-step-link-${group.stepId}`}
          >
            {t("review.validationStepGroup", {
              step: group.stepTitle,
              count: group.issues.length,
            })}
          </button>
          <ul style={{ margin: "0.35rem 0 0", paddingInlineStart: "1.25rem" }}>
            {group.issues.map((issue) => (
              <li key={`${issue.formPath}-${issue.message}`}>
                {issue.formPath.length > 0 && canFocusErrors ? (
                  <button
                    type="button"
                    onClick={() => focusIssue(issue.stepId, issue.formPath)}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      textAlign: "start",
                      textDecoration: "underline",
                    }}
                    data-testid={`${issueLinkTestIdPrefix}-${issue.formPath.replace(/\./g, "-")}`}
                  >
                    {t("review.validationFieldIssue", {
                      label: issue.label,
                      message: issue.message,
                    })}
                  </button>
                ) : (
                  <span data-testid={`${issueLinkTestIdPrefix}-message-only`}>
                    {issue.label.length > 0
                      ? t("review.validationFieldIssue", {
                          label: issue.label,
                          message: issue.message,
                        })
                      : issue.message}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function DenaliReviewValidationSummary({
  onFocusField,
  publishIssues: publishIssuesProp,
}: DenaliReviewValidationSummaryProps = {}) {
  const t = useTranslations("tours.denali");
  const { ruleSet } = useDenaliCanonical();
  const navigation = useDenaliWizardNavigationOptional();
  const form = useDenaliWizardFormSnapshot();

  const visibleSteps = useMemo(
    () => getDenaliWizardVisibleSteps(form, ruleSet),
    [form, ruleSet],
  );

  const validationByStep = useMemo(() => {
    const submitIssues = getDenaliWizardSubmitIssues(form, undefined, ruleSet);
    const views = buildDenaliSubmitIssueViews(submitIssues, form, ruleSet, t);
    return groupDenaliSubmitIssuesByStep(views, visibleSteps);
  }, [form, ruleSet, t, visibleSteps]);

  const publishReadinessByStep = useMemo(() => {
    const publishIssues =
      publishIssuesProp ?? getDenaliWizardPublishReadinessIssuesForTargetStatus(form, "active");
    const views = buildDenaliPublishReadinessIssueViews(publishIssues, form, ruleSet, t);
    return groupDenaliSubmitIssuesByStep(views, visibleSteps);
  }, [form, publishIssuesProp, ruleSet, t, visibleSteps]);

  const allByStep = useMemo(
    () => [...validationByStep, ...publishReadinessByStep],
    [publishReadinessByStep, validationByStep],
  );
  const errorHydrator = useWizardErrorHydrator({ byStep: allByStep, navigation });

  const focusIssue = (stepId: DenaliCreateWizardStepId, formPath: string) => {
    if (formPath.length === 0) return;
    if (onFocusField != null) {
      onFocusField(stepId, formPath);
      return;
    }
    errorHydrator.navigateByFormPath({ stepId, formPath });
  };

  if (validationByStep.length === 0 && publishReadinessByStep.length === 0) {
    return null;
  }

  const canFocusErrors = navigation != null || onFocusField != null;
  const validationCount = validationByStep.reduce((sum, group) => sum + group.issues.length, 0);

  return (
    <>
      {validationByStep.length > 0 ? (
        <div
          role="alert"
          style={{
            padding: "1rem",
            background: "var(--color-danger-50, #fef2f2)",
            color: "var(--color-danger-800, #991b1b)",
            border: "1px solid var(--color-danger-200, #fecaca)",
            borderRadius: "8px",
          }}
          data-testid="denali-summary-error"
        >
          <p style={{ fontWeight: 600, margin: "0 0 0.75rem" }}>
            {t("review.validationSummaryTitle", { count: validationCount })}
          </p>
          <IssueListByStep
            byStep={validationByStep}
            canFocusErrors={canFocusErrors}
            focusIssue={focusIssue}
            t={t}
            issueLinkTestIdPrefix="denali-validation-field-link"
          />
        </div>
      ) : null}

      {publishReadinessByStep.length > 0 ? (
        <div
          role="alert"
          style={{
            padding: "1rem",
            background: "#fffbeb",
            color: "#92400e",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
          }}
          data-testid="denali-review-publish-readiness-warning"
        >
          <p style={{ fontWeight: 600, margin: "0 0 0.75rem" }}>
            {t("review.publishDraftOnlyWarning")}
          </p>
          <IssueListByStep
            byStep={publishReadinessByStep}
            canFocusErrors={canFocusErrors}
            focusIssue={focusIssue}
            t={t}
            issueLinkTestIdPrefix="denali-publish-readiness-field-link"
          />
        </div>
      ) : null}
    </>
  );
}
