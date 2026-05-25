import { BadRequestException } from "@nestjs/common";

import type { TourFormProfile, WizardSubmitRequiredFieldPath } from "@repo/types";

import type { CreateTourDto } from "../dto/create-tour.dto";
import type { TourEntity } from "../entities/tour.entity";
import { WorkspaceStrategyRegistry } from "../strategies/workspace.strategy.registry";

export const VALIDATION_PROFILE_REQUIRED_FIELD = "VALIDATION_PROFILE_REQUIRED_FIELD" as const;

/**
 * Minimal wire shape for profile submit-required checks (POST create and PATCH → OPEN).
 * {@link CreateTourDto} satisfies this type; persisted tours are projected via
 * {@link tourEntityToProfileRequiredSubmitShape}.
 */
export type ProfileRequiredSubmitShape = {
  title: string;
  cost_context?: { totalCost?: number | null } | null;
  tripDetails?: CreateTourDto["tripDetails"] | null;
  transportModes?: readonly string[] | null;
};

/** Projects a merged tour row to the same shape used by POST create asserts. */
export function tourEntityToProfileRequiredSubmitShape(tour: TourEntity): ProfileRequiredSubmitShape {
  let totalCost: number | undefined;
  const raw = tour.costContext;
  if (raw && typeof raw === "object" && "totalCost" in raw) {
    const candidate = (raw as { totalCost?: unknown }).totalCost;
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      totalCost = candidate;
    }
  }

  return {
    title: tour.title,
    cost_context: totalCost !== undefined ? { totalCost } : undefined,
    tripDetails: (tour.details?.tripDetails ?? undefined) as ProfileRequiredSubmitShape["tripDetails"],
    transportModes: tour.transportModes ?? [],
  };
}

/**
 * "Empty for required-ness" — parity with web `profileRules/validation.ts:isEmptyValue`.
 */
function isEmptyRequiredValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "number") {
    return Number.isNaN(value);
  }
  return false;
}

/**
 * Enforces profile-scoped submit required fields after profile strip.
 * Paths and value resolution come from {@link WorkspaceStrategyRegistry}.
 */
export function assertProfileRequiredFieldsForSubmit(
  profile: TourFormProfile,
  dto: ProfileRequiredSubmitShape,
): void {
  const submitFields = WorkspaceStrategyRegistry.resolve(profile).getRequiredSubmitFields();
  const missing: WizardSubmitRequiredFieldPath[] = [];

  for (const path of submitFields.requiredPaths) {
    const value = submitFields.readSubmitFieldValue(dto, path);
    if (isEmptyRequiredValue(value)) {
      missing.push(path);
    }
  }

  if (missing.length === 0) {
    return;
  }

  const fields = [...missing].sort((a, b) => a.localeCompare(b));
  throw new BadRequestException({
    error: {
      code: VALIDATION_PROFILE_REQUIRED_FIELD,
      message: `Missing required fields for profile ${profile}: ${fields.join(", ")}`,
      fields,
    },
  });
}

/**
 * PATCH publish gate — same profile submit-required set as wizard `validateForSubmit` / POST create.
 * Call after merge + strip on the tour row when transitioning to OPEN.
 */
export function assertProfileRequiredFieldsForPublish(
  profile: TourFormProfile,
  shape: ProfileRequiredSubmitShape,
): void {
  assertProfileRequiredFieldsForSubmit(profile, shape);
}
