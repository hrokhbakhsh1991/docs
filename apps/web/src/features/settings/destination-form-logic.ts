import {
  DENALI_DESTINATION_LOCATION_TYPES,
  denaliDestinationMetadataFieldsForType,
  normalizeDenaliDestinationLocationType,
  type DenaliDestinationLocationType,
} from "@app-tour/workspace-denali/settings/destination-location-types";

import { normalizeNumericInputValue, toAsciiDigits } from "@/i18n/format-localized-digits";

import type { DestinationResource } from "./settings-module-types";

export type DestinationFormDraft = {
  readonly regionId: string;
  readonly name: string;
  readonly locationType: DenaliDestinationLocationType;
  readonly altitudeM: string;
  readonly typicalTrailDistanceKm: string;
};

export const EMPTY_DESTINATION_FORM_DRAFT: DestinationFormDraft = {
  regionId: "",
  name: "",
  locationType: "generic",
  altitudeM: "",
  typicalTrailDistanceKm: "",
};

export function destinationFormDraftFromResource(
  destination: DestinationResource
): DestinationFormDraft {
  return {
    regionId: destination.regionId,
    name: destination.name,
    locationType: normalizeDenaliDestinationLocationType(destination.locationType),
    altitudeM:
      destination.altitudeM !== null && destination.altitudeM > 0
        ? String(destination.altitudeM)
        : "",
    typicalTrailDistanceKm:
      destination.typicalTrailDistanceKm !== null && destination.typicalTrailDistanceKm > 0
        ? String(destination.typicalTrailDistanceKm)
        : "",
  };
}

export function parseOptionalPositiveIntField(raw: string): number | null | undefined {
  const trimmed = toAsciiDigits(raw).trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.trunc(parsed);
}

export function parseOptionalPositiveFloatField(raw: string): number | null | undefined {
  const normalized = normalizeNumericInputValue(toAsciiDigits(raw).replace(/٫/g, "."), "decimal");
  if (normalized.length === 0) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

function readMetadataForLocationType(
  draft: DestinationFormDraft
): {
  altitudeM: number | null | undefined;
  typicalTrailDistanceKm: number | null | undefined;
} {
  const metadataFields = denaliDestinationMetadataFieldsForType(draft.locationType);
  const altitudeM = metadataFields.includes("altitudeM")
    ? parseOptionalPositiveIntField(draft.altitudeM)
    : undefined;
  const typicalTrailDistanceKm = metadataFields.includes("typicalTrailDistanceKm")
    ? parseOptionalPositiveFloatField(draft.typicalTrailDistanceKm)
    : undefined;
  return { altitudeM, typicalTrailDistanceKm };
}

export function buildDestinationCreateBody(draft: DestinationFormDraft): Record<string, unknown> | null {
  if (draft.name.trim().length === 0 || draft.regionId.trim().length === 0) {
    return null;
  }
  const { altitudeM, typicalTrailDistanceKm } = readMetadataForLocationType(draft);
  if (altitudeM === null || typicalTrailDistanceKm === null) {
    return null;
  }
  return {
    entity: "destination",
    regionId: draft.regionId.trim(),
    name: draft.name.trim(),
    locationType: draft.locationType,
    ...(altitudeM !== undefined ? { altitudeM } : {}),
    ...(typicalTrailDistanceKm !== undefined ? { typicalTrailDistanceKm } : {}),
  };
}

export function buildDestinationPatchBody(
  draft: DestinationFormDraft
): Record<string, unknown> | null {
  if (draft.name.trim().length === 0 || draft.regionId.trim().length === 0) {
    return null;
  }
  const { altitudeM, typicalTrailDistanceKm } = readMetadataForLocationType(draft);
  if (altitudeM === null || typicalTrailDistanceKm === null) {
    return null;
  }
  const metadataFields = denaliDestinationMetadataFieldsForType(draft.locationType);
  return {
    name: draft.name.trim(),
    regionId: draft.regionId.trim(),
    locationType: draft.locationType,
    altitudeM: metadataFields.includes("altitudeM") ? (altitudeM ?? null) : null,
    typicalTrailDistanceKm: metadataFields.includes("typicalTrailDistanceKm")
      ? (typicalTrailDistanceKm ?? null)
      : null,
  };
}

export function destinationMetadataFieldsForForm(
  locationType: DenaliDestinationLocationType
): readonly ("altitudeM" | "typicalTrailDistanceKm")[] {
  return denaliDestinationMetadataFieldsForType(locationType);
}

export function formatDestinationMetadataSummary(destination: DestinationResource): string | null {
  const locationType = normalizeDenaliDestinationLocationType(destination.locationType);
  if (locationType === "peak" && destination.altitudeM !== null && destination.altitudeM > 0) {
    return `${destination.altitudeM}m`;
  }
  if (
    locationType === "nature_trail" &&
    destination.typicalTrailDistanceKm !== null &&
    destination.typicalTrailDistanceKm > 0
  ) {
    return `${destination.typicalTrailDistanceKm}km`;
  }
  return null;
}

export { DENALI_DESTINATION_LOCATION_TYPES };
