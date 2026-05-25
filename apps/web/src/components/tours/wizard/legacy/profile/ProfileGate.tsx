"use client";

import type { ReactNode } from "react";
import { useTourWizardProfile } from "@/features/tours/wizard/TourWizardProfileContext";

export type ProfileGateProps = {
  readonly flag: "allowDraft"; // Extend this union as more flags are added to rules
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
};

/**
 * Renders children based on profile-level flags.
 * Today it primarily gates the DraftNotice in ReviewSubmitStep.
 */
export function ProfileGate({ flag, children, fallback }: ProfileGateProps): ReactNode {
  const { resolvedProfile } = useTourWizardProfile();

  // For now, allowDraft is true for all Denali-related profiles.
  // This can be moved to the rules engine if it becomes more complex.
  const isDenaliProfile = resolvedProfile.startsWith("mountain") ||
                          resolvedProfile.startsWith("nature") ||
                          resolvedProfile.startsWith("cinema");

  const isEnabled = flag === "allowDraft" ? isDenaliProfile : false;

  return isEnabled ? children : (fallback ?? null);
}
