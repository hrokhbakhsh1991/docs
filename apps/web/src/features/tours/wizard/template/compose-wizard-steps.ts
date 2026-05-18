import { wizardSteps, type TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

import type { TenantWizardStepOverrides } from "./tenant-wizard-template.types";

const CANONICAL_STEP_SET = new Set<TourCreateWizardStepId>(wizardSteps);

function normalizeStepId(raw: string): TourCreateWizardStepId | null {
  const id = raw.trim() as TourCreateWizardStepId;
  return CANONICAL_STEP_SET.has(id) ? id : null;
}

/**
 * Applies DB `stepOverrides` after profile + tenant visibility.
 * `insert` is reserved for future dynamic steps; v1 only honors `skip`.
 */
export function composeWizardSteps(
  baseSteps: readonly TourCreateWizardStepId[],
  overrides: TenantWizardStepOverrides | undefined,
): TourCreateWizardStepId[] {
  if (!overrides?.skip?.length) {
    return [...baseSteps];
  }
  const skip = new Set<TourCreateWizardStepId>();
  for (const raw of overrides.skip) {
    const id = normalizeStepId(raw);
    if (id) {
      skip.add(id);
    }
  }
  if (skip.size === 0) {
    return [...baseSteps];
  }
  return baseSteps.filter((step) => !skip.has(step));
}

export function parseTenantWizardStepOverrides(raw: unknown): TenantWizardStepOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { skip: [], insert: [] };
  }
  const o = raw as Record<string, unknown>;
  const skip: TourCreateWizardStepId[] = [];
  const insert: TourCreateWizardStepId[] = [];
  if (Array.isArray(o.skip)) {
    for (const entry of o.skip) {
      if (typeof entry === "string") {
        const id = normalizeStepId(entry);
        if (id) {
          skip.push(id);
        }
      }
    }
  }
  if (Array.isArray(o.insert)) {
    for (const entry of o.insert) {
      if (typeof entry === "string") {
        const id = normalizeStepId(entry);
        if (id) {
          insert.push(id);
        }
      }
    }
  }
  return { skip, insert };
}
