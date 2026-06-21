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

/** P3-B — platform review/validation surface factory for wizard-surface-bindings codegen. */
export function createPlatformReviewSurface(): WizardReviewSurface {
  return Object.freeze({
    renderValidationSummary: renderPlatformValidationSummary,
  });
}
