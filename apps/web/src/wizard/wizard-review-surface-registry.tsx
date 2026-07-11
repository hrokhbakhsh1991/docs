"use client";

import type { ReactNode } from "react";

import { WorkspaceWizardValidationSummary } from "./workspace-wizard-validation-summary";
import type {
  WizardReviewSurface,
  WizardValidationSurface,
  WizardValidationSurfaceRenderProps,
} from "./wizard-surface-types";
import { resolveGeneratedReviewSurface } from "@/bootstrap/wizard-surface-bindings.generated";

function renderPlatformValidationSummary(props: WizardValidationSurfaceRenderProps): ReactNode {
  return <WorkspaceWizardValidationSummary {...props} />;
}

const platformValidationSurface: WizardValidationSurface = Object.freeze({
  renderValidationSummary: renderPlatformValidationSummary,
});

export type {
  WizardCompletionSnapshot,
  WizardReviewSurface,
  WizardReviewSurfaceRenderProps,
  WizardStepDescriptor,
  WizardValidationSurfaceRenderProps,
} from "./wizard-surface-types";

export function resolveWizardReviewSurface(surfaceId: string | undefined): WizardReviewSurface | null {
  if (surfaceId === "platform") {
    return platformValidationSurface;
  }
  return resolveGeneratedReviewSurface(surfaceId);
}

/** Step-nav + review validation UI — falls back to reviewSurfaceId, then platform default. */
export function resolveWizardValidationSurface(
  validationSurfaceId: string | undefined,
  reviewSurfaceId: string | undefined
): WizardValidationSurface {
  const surfaceId = validationSurfaceId ?? reviewSurfaceId ?? "platform";
  const surface = resolveWizardReviewSurface(surfaceId);
  if (surface?.renderValidationSummary != null) {
    return { renderValidationSummary: surface.renderValidationSummary };
  }
  return platformValidationSurface;
}

export function buildWizardValidationSurfaceProps(
  input: Pick<
    WizardValidationSurfaceRenderProps,
    | "issues"
    | "stepDescriptors"
    | "onFocusIssue"
    | "fieldLabelSurfaceId"
    | "translateWorkspaceMessage"
    | "validationHeadingKey"
  >
): WizardValidationSurfaceRenderProps {
  return {
    issues: input.issues,
    stepDescriptors: input.stepDescriptors,
    onFocusIssue: input.onFocusIssue,
    fieldLabelSurfaceId: input.fieldLabelSurfaceId,
    translateWorkspaceMessage: input.translateWorkspaceMessage,
    validationHeadingKey: input.validationHeadingKey,
  };
}
