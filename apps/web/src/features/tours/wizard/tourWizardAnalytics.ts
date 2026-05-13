import type { TourFormProfile } from "@repo/types";

import type { TourCreateWizardStepId } from "./stepConfig";

export type TourWizardAnalyticsEventType = "wizard_step_view" | "wizard_step_next";

export type TourWizardAnalyticsDetail = {
  type: TourWizardAnalyticsEventType;
  step: TourCreateWizardStepId;
  formProfile: TourFormProfile;
};

const EVENT_NAME = "tour_wizard_analytics";

/**
 * Dispatches a DOM event for optional product analytics adapters. No-op if `window` is missing.
 * Wire a listener in your analytics layer if needed; default install has none.
 */
export function emitTourWizardAnalytics(detail: TourWizardAnalyticsDetail): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  } catch {
    /* ignore */
  }
}
