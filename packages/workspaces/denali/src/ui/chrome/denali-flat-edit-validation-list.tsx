"use client";

import type { ValidationIssue } from "@app-tour/wizard-navigation";
import { useTranslations } from "next-intl";

import { resolveWizardValidationIssueMessage } from "../adapters/resolve-wizard-validation-issue-message";
import { resolveDenaliWizardValidationFieldLabel } from "../adapters/wizard-validation-field-label";

export const DENALI_FLAT_EDIT_VALIDATION_TEST_IDS = {
  list: "denali-flat-edit-validation-list",
  item: "denali-flat-edit-validation-item",
} as const;

type DenaliFlatEditValidationListProps = {
  readonly issues: readonly ValidationIssue[];
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
};

/** Flat edit submit validation — same code → i18n contract as create-tour review panel. */
export function DenaliFlatEditValidationList({
  issues,
  translateWorkspaceMessage,
}: DenaliFlatEditValidationListProps) {
  const t = useTranslations("denali");
  const tValidation = useTranslations("denali.review.validation");
  const translateFieldLabel =
    translateWorkspaceMessage ?? ((key: string) => t(key));
  const validationTranslator = {
    has: (key: string) => tValidation.has(key),
    translate: (key: string, values: { field: string }) => tValidation(key, values),
  };

  if (issues.length === 0) {
    return null;
  }

  return (
    <ul
      className="denali-flat-edit-validation__list"
      data-testid={DENALI_FLAT_EDIT_VALIDATION_TEST_IDS.list}
      data-operator-flat-edit-validation
    >
      {issues.map((issue) => {
        const fieldLabel = resolveDenaliWizardValidationFieldLabel({
          canonicalPath: issue.path,
          translateWorkspaceMessage: translateFieldLabel,
        });
        const message = resolveWizardValidationIssueMessage(
          issue,
          validationTranslator,
          fieldLabel
        );
        return (
          <li
            key={`${issue.path}:${issue.code ?? issue.message}`}
            data-testid={`${DENALI_FLAT_EDIT_VALIDATION_TEST_IDS.item}-${issue.path.replace(/\./g, "-")}`}
          >
            <span className="denali-flat-edit-validation__field">{fieldLabel}</span>
            <span className="denali-flat-edit-validation__message">{message}</span>
          </li>
        );
      })}
    </ul>
  );
}
