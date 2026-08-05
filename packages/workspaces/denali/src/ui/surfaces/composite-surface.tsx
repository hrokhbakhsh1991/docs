"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-rule-eval-context";
import type { WizardCompositeFieldRenderProps, WizardCompositeSurface } from "./wizard-surface-types";

const DenaliCompositeField = dynamic(
  () => import("./composite-field").then((mod) => mod.DenaliCompositeField),
  {
    ssr: false,
    loading: () => <p data-operator-wizard-composite-loading aria-busy="true" />,
  }
);

/** Phase 14.0 — Denali composite surface factory for manifest codegen. */
export function createDenaliCompositeSurface(): WizardCompositeSurface {
  return Object.freeze({
    renderCompositeField: (props: WizardCompositeFieldRenderProps): ReactNode => (
      <DenaliCompositeField
        compositeId={props.compositeId}
        field={props.field}
        draft={props.draft}
        onDraftChange={props.onDraftChange}
        wizardSessionId={props.wizardSessionId}
        workspaceFormProfile={props.workspaceFormProfile}
        wizardRuleEvalContext={
          props.wizardRuleEvalContext as Pick<DenaliWizardRuleEvalContext, "ruleSet"> | undefined
        }
        invalid={props.invalid}
        validationIssuePaths={props.validationIssuePaths}
      />
    ),
  });
}
