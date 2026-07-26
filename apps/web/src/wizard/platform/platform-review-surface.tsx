"use client";

import React, { type ReactNode } from "react";

import { WorkspaceWizardValidationSummary } from "@/wizard/workspace-wizard-validation-summary";
import type {
  WizardReviewSurface,
  WizardValidationSurfaceRenderProps,
} from "@/wizard/wizard-surface-types";

function renderPlatformValidationSummary(props: WizardValidationSurfaceRenderProps): ReactNode {
  return <WorkspaceWizardValidationSummary {...props} />;
}

/** P3-B / Phase 4as — shell-local platform review surface (eager in wizard-surface-registry). */
export function createPlatformReviewSurface(): WizardReviewSurface {
  return Object.freeze({
    renderValidationSummary: renderPlatformValidationSummary,
  });
}
