"use client";

import type { ReactNode } from "react";

import { isFieldVisibleForTenantContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { useTourWizardProfile } from "@/features/tours/wizard/TourWizardProfileContext";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

import { useIsFieldVisible } from "./useProfileRules";

export type FieldGateProps = {
  readonly field: WizardFieldPath | string;
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
};

/**
 * Render `children` only when the field is visible for the current profile (as defined by the
 * rules table in `profileRules/`). Returns `fallback` (or `null`) when hidden.
 *
 * Today's wizard step components do not have inline `if (profile === ...)` blocks, so
 * wrapping a field with `<FieldGate>` is parity-preserving for every shipped profile — it
 * simply routes the visibility decision through the canonical rules layer.
 */
export function FieldGate({ field, children, fallback }: FieldGateProps): ReactNode {
  const profileVisible = useIsFieldVisible(field);
  const { tenantFormContract } = useTourWizardProfile();
  const tenantVisible = isFieldVisibleForTenantContract(field, tenantFormContract);
  return profileVisible && tenantVisible ? children : (fallback ?? null);
}
