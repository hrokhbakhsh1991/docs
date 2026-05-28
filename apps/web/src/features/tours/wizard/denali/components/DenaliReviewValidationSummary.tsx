"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { getDenaliWizardVisibleSteps, useDenaliCanonical, useDenaliWizardFormSnapshot } from "../application";

import { useDenaliWizardNavigationOptional } from "../DenaliWizardNavigationContext";
import { collectDenaliWizardSubmitIssuePresentation } from "../denaliWizardSubmitIssuePresentation";
import { useWizardErrorHydrator } from "./WizardErrorHydrator";

export function DenaliReviewValidationSummary() {
  const t = useTranslations("tours.denali");
  const { ruleSet } = useDenaliCanonical();
  const navigation = useDenaliWizardNavigationOptional();
  const form = useDenaliWizardFormSnapshot();

  const visibleSteps = useMemo(
    () => getDenaliWizardVisibleSteps(form, ruleSet),
    [form, ruleSet],
  );

  const { byStep } = useMemo(
    () =>
      collectDenaliWizardSubmitIssuePresentation({
        form,
        ruleSet,
        stepOrder: visibleSteps,
        t,
      }),
    [form, ruleSet, t, visibleSteps],
  );
  const errorHydrator = useWizardErrorHydrator({ byStep, navigation });

  if (byStep.length === 0) {
    return null;
  }

  const totalIssues = byStep.reduce((sum, group) => sum + group.issues.length, 0);

  return (
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
        {t("review.validationSummaryTitle", { count: totalIssues })}
      </p>
      <div style={{ display: "grid", gap: "0.85rem" }}>
        {byStep.map((group) => (
          <section key={group.stepId} data-testid={`denali-validation-step-${group.stepId}`}>
            <button
              type="button"
              onClick={() =>
                errorHydrator.navigateByFormPath({
                  stepId: group.stepId,
                  formPath: group.issues[0]!.formPath,
                })
              }
              style={{
                display: "block",
                width: "100%",
                textAlign: "start",
                padding: 0,
                border: "none",
                background: "transparent",
                color: "inherit",
                fontWeight: 600,
                cursor: navigation ? "pointer" : "default",
                textDecoration: navigation ? "underline" : "none",
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
                  <button
                    type="button"
                    onClick={() =>
                      errorHydrator.navigateByFormPath({
                        stepId: issue.stepId,
                        formPath: issue.formPath,
                      })
                    }
                    style={{
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: navigation ? "pointer" : "default",
                      textAlign: "start",
                      textDecoration: navigation ? "underline" : "none",
                    }}
                    data-testid={`denali-validation-field-link-${issue.formPath.replace(/\./g, "-")}`}
                  >
                    {t("review.validationFieldIssue", {
                      label: issue.label,
                      message: issue.message,
                    })}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
