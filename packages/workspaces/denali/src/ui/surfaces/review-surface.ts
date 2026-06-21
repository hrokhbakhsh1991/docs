"use client";

import { denaliWizardReviewSurface } from "./review-surface-impl";
import type { WizardReviewSurface } from "./wizard-surface-types";

/** Phase 14.0 — Denali review surface factory for manifest codegen. */
export function createDenaliReviewSurface(): WizardReviewSurface {
  return denaliWizardReviewSurface;
}
