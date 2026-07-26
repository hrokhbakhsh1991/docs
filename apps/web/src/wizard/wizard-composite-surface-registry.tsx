"use client";

import type { WizardCompositeSurface } from "./wizard-surface-types";
import { resolveGeneratedCompositeSurface } from "@/wizard/wizard-surface-registry";

export type {
  WizardCompositeFieldRenderProps,
  WizardCompositeSurface,
} from "./wizard-surface-types";

export function resolveWizardCompositeSurface(
  surfaceId: string | undefined
): WizardCompositeSurface | null {
  return resolveGeneratedCompositeSurface(surfaceId);
}
