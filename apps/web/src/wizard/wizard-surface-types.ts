import type { RenderFieldPlan, RenderStepPlan } from "@app-tour/platform-core";
import type { ValidationIssue } from "@app-tour/wizard-navigation";
import type { ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

export type WizardStepDescriptor = {
  readonly stepId: string;
  readonly label: string;
};

export type WizardCompositeFieldRenderProps = {
  readonly compositeId: string;
  readonly field: RenderFieldPlan;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
  readonly wizardRuleEvalContext?: unknown;
};

export type WizardCompositeSurface = {
  readonly renderCompositeField: (props: WizardCompositeFieldRenderProps) => ReactNode;
};

export type WizardLabelResolver = {
  readonly resolveFieldLabel: (
    translate: (key: string) => string,
    canonicalPath: string
  ) => string;
  readonly resolveStepLabel?: (
    translate: (key: string) => string,
    stepId: string
  ) => string;
  readonly resolveEnumOptionLabel?: (
    translate: (key: string) => string,
    canonicalPath: string,
    value: string
  ) => string;
  readonly resolveValidationIssueLabel?: (
    translate: (key: string) => string,
    pathOrCompositeId: string
  ) => string;
};

/** Opaque completion snapshot — workspace surfaces define their own shape. */
export type WizardCompletionSnapshot = Readonly<Record<string, unknown>>;

export type WizardValidationSurfaceRenderProps = {
  readonly issues: readonly ValidationIssue[];
  readonly stepDescriptors: readonly WizardStepDescriptor[];
  readonly onFocusIssue: (stepId: string, path: string) => void;
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
  /** `step` — blocked Continue; `submit` — create/publish blocked (default). */
  readonly validationHeadingKey?: "review.stepValidationHeading" | "review.validationHeading";
};

export type WizardReviewSurfaceRenderProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly reviewValidationIssues: readonly ValidationIssue[];
  readonly stepDescriptors: readonly WizardStepDescriptor[];
  /** Content steps only — excludes the injected review step (INV-WIZ-002). */
  readonly contentSteps: readonly RenderStepPlan[];
  readonly onNavigateToStep?: (stepId: string) => void;
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

export type WizardValidationSurface = Required<Pick<WizardReviewSurface, "renderValidationSummary">>;
