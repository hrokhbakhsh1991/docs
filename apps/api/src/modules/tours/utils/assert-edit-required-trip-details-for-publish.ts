import { BadRequestException } from "@nestjs/common";
import { getEditRequiredTripDetailsPathsForProfile, type TourFormProfile } from "@repo/types";

export const VALIDATION_PROFILE_EDIT_REQUIRED_FIELD =
  "VALIDATION_PROFILE_EDIT_REQUIRED_FIELD" as const;

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

function readTripDetailsByEditPath(
  tripDetails: Record<string, unknown> | null | undefined,
  editPath: string,
): unknown {
  if (tripDetails == null) {
    return undefined;
  }
  const segments = editPath.split(".");
  let current: unknown = tripDetails;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Enforces Edit-matrix `required` presets at publish (mountain_outdoor today).
 * Complements wizard submit-required ({@link assertProfileRequiredFieldsForSubmit}).
 */
export function assertEditRequiredTripDetailsForPublish(
  profile: TourFormProfile,
  tripDetails: Record<string, unknown> | null | undefined,
): void {
  const requiredPaths = getEditRequiredTripDetailsPathsForProfile(profile);
  if (requiredPaths.length === 0) {
    return;
  }

  const missing: string[] = [];
  for (const path of requiredPaths) {
    const value = readTripDetailsByEditPath(tripDetails, path);
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
      code: VALIDATION_PROFILE_EDIT_REQUIRED_FIELD,
      message: `Missing Edit-required tripDetails fields for profile ${profile}: ${fields.join(", ")}`,
      fields,
    },
  });
}
