"use client";

import type { ReactNode } from "react";

import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

import { useStepRule } from "./useProfileRules";

export type StepGateProps = {
  readonly step: TourCreateWizardStepId;
  readonly children: ReactNode;
};

/** Render `children` only when the step is `visible` for the current profile. */
export function StepGate({ step, children }: StepGateProps): ReactNode {
  const rule = useStepRule(step);
  return rule?.visibility === "visible" ? children : null;
}
