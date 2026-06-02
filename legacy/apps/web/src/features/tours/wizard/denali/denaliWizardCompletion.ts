import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  DENALI_FIELD_REGISTRY,
  type DenaliFieldRegistryEntry,
} from "./registry/DenaliFieldRegistry";
import type { DenaliZodFieldKind } from "@repo/denali-domain";

export type DenaliWizardCompletionScore = {
  percentage: number;
  filledWeight: number;
  totalWeight: number;
};

function readRhfPath(form: DenaliCreateTourWizardForm, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, form);
}

function isLocationDataFilled(value: unknown): boolean {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.addressText === "string" && row.addressText.trim() !== "") {
    return true;
  }
  return row.latitude != null && row.longitude != null;
}

function isItineraryFilled(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.some((row) => {
    if (row == null || typeof row !== "object") {
      return false;
    }
    const entry = row as Record<string, unknown>;
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const activities = typeof entry.activities === "string" ? entry.activities.trim() : "";
    const location =
      typeof entry.location === "string"
        ? entry.location.trim()
        : typeof entry.locationLabel === "string"
          ? entry.locationLabel.trim()
          : "";
    return title !== "" || activities !== "" || location !== "";
  });
}

function isGatheringPointsFilled(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.some((row) => {
    if (row == null || typeof row !== "object") {
      return false;
    }
    const entry = row as Record<string, unknown>;
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    return title !== "" || isLocationDataFilled(entry.location);
  });
}

function isGearItemsFilled(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isPhotosFilled(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isDenaliRegistryFieldFilled(
  value: unknown,
  zodKind: DenaliZodFieldKind | undefined,
): boolean {
  if (value == null) {
    return false;
  }

  switch (zodKind) {
    case "photos":
      return isPhotosFilled(value);
    case "itinerary":
      return isItineraryFilled(value);
    case "gatheringPoints":
      return isGatheringPointsFilled(value);
    case "gearItems":
      return isGearItemsFilled(value);
    case "locationData":
      return isLocationDataFilled(value);
    case "stringOptional":
    case "title":
    case "socialMediaLink":
    case "approximateReturnTime":
      return typeof value === "string" && value.trim() !== "";
    case "stringArrayDefault":
      return Array.isArray(value) && value.length > 0;
    case "booleanOptional":
    case "adminCapacityApproval":
      return value === true;
    case "optionalInt":
    case "optionalPositiveInt":
    case "capacityMax":
    case "difficultyLevel":
    case "minRequiredPeaks":
      return typeof value === "number" && Number.isFinite(value);
    case "tourType":
    case "publishStatus":
    case "destinationId":
    case "isoDateTime":
    case "isoDateTimeOptional":
    case "transportMode":
    case "paymentMode":
    case "fitnessLevel":
      if (typeof value === "string") {
        return value.trim() !== "";
      }
      return value != null && value !== "";
    default:
      if (typeof value === "string") {
        return value.trim() !== "";
      }
      if (typeof value === "number") {
        return Number.isFinite(value);
      }
      if (typeof value === "boolean") {
        return value;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === "object") {
        return Object.keys(value as object).length > 0;
      }
      return false;
  }
}

function buildCompletionFieldMap(
  entries: readonly DenaliFieldRegistryEntry[],
): Map<string, { weight: number; zodKind?: DenaliZodFieldKind }> {
  const byRhfPath = new Map<string, { weight: number; zodKind?: DenaliZodFieldKind }>();

  for (const entry of entries) {
    if (entry.weight <= 0) {
      continue;
    }
    const existing = byRhfPath.get(entry.rhfPath);
    if (existing == null || entry.weight > existing.weight) {
      byRhfPath.set(entry.rhfPath, { weight: entry.weight, zodKind: entry.zodKind });
    }
  }

  return byRhfPath;
}

export function calculateDenaliWizardCompletionScore(
  formValues: DenaliCreateTourWizardForm,
  entries: readonly DenaliFieldRegistryEntry[] = DENALI_FIELD_REGISTRY,
): DenaliWizardCompletionScore {
  const fields = buildCompletionFieldMap(entries);
  let filledWeight = 0;
  let totalWeight = 0;

  for (const [rhfPath, meta] of fields) {
    totalWeight += meta.weight;
    const value = readRhfPath(formValues, rhfPath);
    if (isDenaliRegistryFieldFilled(value, meta.zodKind)) {
      filledWeight += meta.weight;
    }
  }

  const percentage =
    totalWeight === 0 ? 0 : Math.min(100, Math.round((filledWeight / totalWeight) * 100));

  return {
    percentage,
    filledWeight,
    totalWeight,
  };
}

export function calculateCompletionPercentage(formValues: DenaliCreateTourWizardForm): number {
  return calculateDenaliWizardCompletionScore(formValues).percentage;
}
