"use client";

import type { ReactNode } from "react";

import { DenaliPublishStatusField } from "../fields/denali-publish-status-field";
import {
  computeDenaliWizardCompletion,
  type DenaliWizardCompletionSnapshot,
} from "../logic/denali-wizard-completion";
import { DenaliReviewStep } from "../review/denali-review-step";
import { DenaliReviewValidationSummary } from "../review/denali-review-validation-summary";
import { DenaliWizardContentQualityHeader } from "../review/denali-wizard-content-quality-header";
import type {
  WizardCompletionSnapshot,
  WizardReviewSurface,
  WizardReviewSurfaceRenderProps,
  WizardValidationSurfaceRenderProps,
} from "../surfaces/wizard-surface-types";

function renderDenaliValidationSummary(props: WizardValidationSurfaceRenderProps): ReactNode {
  return (
    <DenaliReviewValidationSummary
      issues={props.issues}
      stepDescriptors={props.stepDescriptors}
      onFocusIssue={props.onFocusIssue}
      fieldLabelSurfaceId={props.fieldLabelSurfaceId}
      translateWorkspaceMessage={props.translateWorkspaceMessage}
    />
  );
}

function renderDenaliReviewChrome(props: WizardReviewSurfaceRenderProps): ReactNode {
  return (
    <>
      {renderDenaliValidationSummary({
        issues: props.reviewValidationIssues,
        stepDescriptors: props.stepDescriptors,
        onFocusIssue: props.onFocusIssue,
        fieldLabelSurfaceId: props.fieldLabelSurfaceId,
        translateWorkspaceMessage: props.translateWorkspaceMessage,
      })}
      <DenaliReviewStep draft={props.draft} />
      <div className="denali-review__publish">
        <DenaliPublishStatusField draft={props.draft} onDraftChange={props.onDraftChange} />
      </div>
    </>
  );
}

/** Denali workspace review + validation surface (Phase 12.1). */
export const denaliWizardReviewSurface: WizardReviewSurface = Object.freeze({
  computeCompletion: (draft, visibleSteps) =>
    computeDenaliWizardCompletion(draft, visibleSteps) as unknown as WizardCompletionSnapshot,
  renderCompletionHeader: (completion) => (
    <DenaliWizardContentQualityHeader
      completion={completion as DenaliWizardCompletionSnapshot}
    />
  ),
  renderValidationSummary: renderDenaliValidationSummary,
  renderReviewChrome: renderDenaliReviewChrome,
});
