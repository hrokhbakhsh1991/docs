import type { RenderStepPlan } from "@app-tour/platform-core";
import type { ValidationIssue } from "@app-tour/wizard-navigation";
import type { ReactNode } from "react";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-rule-eval-context";

export type WizardLabelResolver = {
  readonly resolveFieldLabel: (
    translate: (key: string) => string,
    canonicalPath: string
  ) => string;
  readonly resolveStepLabel?: (
    translate: (key: string) => string,
    stepId: string
  ) => string;
};

export type WizardStepDescriptor = {
  readonly stepId: string;
  readonly label: string;
};

export type WizardCompositeFieldRenderProps = {
  readonly compositeId: string;
  readonly field: import("@app-tour/platform-core").RenderFieldPlan;
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
  readonly wizardRuleEvalContext?: Pick<DenaliWizardRuleEvalContext, "ruleSet">;
};

export type WizardCompositeSurface = {
  readonly renderCompositeField: (props: WizardCompositeFieldRenderProps) => ReactNode;
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
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
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
    draft: DenaliTourWizardDraft,
    visibleSteps: readonly RenderStepPlan[]
  ) => WizardCompletionSnapshot | null;
  readonly renderCompletionHeader?: (completion: WizardCompletionSnapshot) => ReactNode;
  readonly renderValidationSummary?: (props: WizardValidationSurfaceRenderProps) => ReactNode;
  readonly renderReviewChrome?: (props: WizardReviewSurfaceRenderProps) => ReactNode;
};
