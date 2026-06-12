"use client";

import type { RenderStepPlan } from "@app-tour/platform-core";
import type { ValidationIssue } from "@app-tour/wizard-navigation";
import type { ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import {
  computeDenaliWizardCompletion,
  type DenaliWizardCompletionSnapshot,
} from "./denali/denali-wizard-completion";
import { DenaliWizardContentQualityHeader } from "./denali/denali-wizard-content-quality-header";
import { DenaliPublishStatusField } from "./denali/denali-publish-status-field";
import { DenaliReviewStep } from "./denali/denali-review-step";
import { DenaliReviewValidationSummary } from "./denali/denali-review-validation-summary";

export type WizardReviewSurfaceRenderProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly reviewValidationIssues: readonly ValidationIssue[];
  readonly stepDescriptors: readonly { readonly stepId: string; readonly label: string }[];
  readonly onFocusIssue: (stepId: string, path: string) => void;
};

export type WizardReviewSurface = {
  readonly computeCompletion?: (
    draft: TourWizardDraft,
    visibleSteps: readonly RenderStepPlan[]
  ) => DenaliWizardCompletionSnapshot | null;
  readonly renderCompletionHeader?: (completion: DenaliWizardCompletionSnapshot) => ReactNode;
  readonly renderReviewChrome?: (props: WizardReviewSurfaceRenderProps) => ReactNode;
};

const DENALI_REVIEW_SURFACE: WizardReviewSurface = Object.freeze({
  computeCompletion: computeDenaliWizardCompletion,
  renderCompletionHeader: (completion) => (
    <DenaliWizardContentQualityHeader completion={completion} />
  ),
  renderReviewChrome: (props) => (
    <>
      <DenaliReviewStep draft={props.draft} />
      <DenaliReviewValidationSummary
        issues={props.reviewValidationIssues}
        steps={props.stepDescriptors}
        onFocusIssue={props.onFocusIssue}
      />
      <DenaliPublishStatusField draft={props.draft} onDraftChange={props.onDraftChange} />
    </>
  ),
});

const WIZARD_REVIEW_SURFACE_REGISTRY: Readonly<Record<string, WizardReviewSurface>> = Object.freeze({
  denali: DENALI_REVIEW_SURFACE,
});

export function resolveWizardReviewSurface(
  surfaceId: string | undefined
): WizardReviewSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return WIZARD_REVIEW_SURFACE_REGISTRY[surfaceId] ?? null;
}
