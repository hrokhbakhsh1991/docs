import type { RenderStepPlan } from "@app-tour/platform-core";
import type { ValidationIssue } from "@app-tour/wizard-navigation";
import type { ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

export type WizardStepDescriptor = {
  readonly stepId: string;
  readonly label: string;
};

/** Opaque completion snapshot — workspace surfaces define their own shape. */
export type WizardCompletionSnapshot = Readonly<Record<string, unknown>>;

export type WizardValidationSurfaceRenderProps = {
  readonly issues: readonly ValidationIssue[];
  readonly stepDescriptors: readonly WizardStepDescriptor[];
  readonly onFocusIssue: (stepId: string, path: string) => void;
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
};

export type WizardReviewSurfaceRenderProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly reviewValidationIssues: readonly ValidationIssue[];
  readonly stepDescriptors: readonly WizardStepDescriptor[];
  readonly onFocusIssue: (stepId: string, path: string) => void;
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
};

export type WizardReviewSurface = {
  readonly computeCompletion?: (
    draft: TourWizardDraft,
    visibleSteps: readonly RenderStepPlan[]
  ) => WizardCompletionSnapshot | null;
  readonly renderCompletionHeader?: (completion: WizardCompletionSnapshot) => ReactNode;
  readonly renderValidationSummary?: (props: WizardValidationSurfaceRenderProps) => ReactNode;
  readonly renderReviewChrome?: (props: WizardReviewSurfaceRenderProps) => ReactNode;
};

export type WizardValidationSurface = Pick<WizardReviewSurface, "renderValidationSummary">;
