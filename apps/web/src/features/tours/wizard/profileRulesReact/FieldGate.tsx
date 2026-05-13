"use client";

import type { ReactNode } from "react";

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
  return useIsFieldVisible(field) ? children : (fallback ?? null);
}
