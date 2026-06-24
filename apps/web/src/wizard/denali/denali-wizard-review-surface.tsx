"use client";

import type { ReactNode } from "react";

import type {
  WizardCompletionSnapshot,
  WizardReviewSurface,
  WizardReviewSurfaceRenderProps,
  WizardValidationSurfaceRenderProps,
} from "../wizard-surface-types";

import {
  computeDenaliWizardCompletion,
  type DenaliWizardCompletionSnapshot,
} from "./denali-wizard-completion";
import { DenaliWizardContentQualityHeader } from "./denali-wizard-content-quality-header";
import { DenaliPublishStatusField } from "./denali-publish-status-field";
import { DenaliReviewStep } from "@app-tour/workspace-denali/ui/review/denali-review-step";
import { DenaliReviewValidationSummary } from "./denali-review-validation-summary";

function renderDenaliValidationSummary(props: WizardValidationSurfaceRenderProps): ReactNode {
  return (
    <DenaliReviewValidationSummary
      issues={props.issues}
      stepDescriptors={props.stepDescriptors}
      onFocusIssue={props.onFocusIssue}
      fieldLabelSurfaceId={props.fieldLabelSurfaceId}
      translateWorkspaceMessage={props.translateWorkspaceMessage}
      validationHeadingKey={props.validationHeadingKey}
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
      <DenaliReviewStep
        draft={props.draft}
        contentSteps={props.contentSteps}
        onNavigateToStep={props.onNavigateToStep}
      />
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
