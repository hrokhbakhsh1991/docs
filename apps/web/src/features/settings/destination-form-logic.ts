import { resolveSettingsDestinationSurface } from "@/features/settings/settings-destination-registry";

import { normalizeNumericInputValue, toAsciiDigits } from "@/i18n/format-localized-digits";

import type { DestinationLocationType } from "./destination-settings-surface-types";
import type { DestinationResource } from "./settings-module-types";

export type { DestinationLocationType };

export type DestinationFormDraft = {
  readonly regionId: string;
  readonly name: string;
  readonly locationType: DestinationLocationType;
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

function requireDestinationSurface(pluginId: string) {
  const surface = resolveSettingsDestinationSurface(pluginId);
  if (surface == null) {
    throw new Error(`No destination settings surface for plugin: ${pluginId}`);
  }
  return surface;
}

export function destinationLocationTypesForPlugin(pluginId: string) {
  return requireDestinationSurface(pluginId).locationTypes;
}

export function destinationFormDraftFromResource(
  destination: DestinationResource,
  pluginId: string
): DestinationFormDraft {
  const surface = requireDestinationSurface(pluginId);
  return {
    regionId: destination.regionId,
    name: destination.name,
    locationType: surface.normalizeLocationType(destination.locationType),
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
  draft: DestinationFormDraft,
  pluginId: string
): {
  altitudeM: number | null | undefined;
  typicalTrailDistanceKm: number | null | undefined;
} {
  const surface = requireDestinationSurface(pluginId);
  const metadataFields = surface.metadataFieldsForType(draft.locationType);
  const altitudeM = metadataFields.includes("altitudeM")
    ? parseOptionalPositiveIntField(draft.altitudeM)
    : undefined;
  const typicalTrailDistanceKm = metadataFields.includes("typicalTrailDistanceKm")
    ? parseOptionalPositiveFloatField(draft.typicalTrailDistanceKm)
    : undefined;
  return { altitudeM, typicalTrailDistanceKm };
}

export function buildDestinationCreateBody(
  draft: DestinationFormDraft,
  pluginId: string
): Record<string, unknown> | null {
  if (draft.name.trim().length === 0 || draft.regionId.trim().length === 0) {
    return null;
  }
  const { altitudeM, typicalTrailDistanceKm } = readMetadataForLocationType(draft, pluginId);
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
  draft: DestinationFormDraft,
  pluginId: string
): Record<string, unknown> | null {
  if (draft.name.trim().length === 0 || draft.regionId.trim().length === 0) {
    return null;
  }
  const surface = requireDestinationSurface(pluginId);
  const { altitudeM, typicalTrailDistanceKm } = readMetadataForLocationType(draft, pluginId);
  if (altitudeM === null || typicalTrailDistanceKm === null) {
    return null;
  }
  const metadataFields = surface.metadataFieldsForType(draft.locationType);
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
  locationType: DestinationLocationType,
  pluginId: string
): readonly ("altitudeM" | "typicalTrailDistanceKm")[] {
  return requireDestinationSurface(pluginId).metadataFieldsForType(locationType);
}

export function formatDestinationMetadataSummary(
  destination: DestinationResource,
  pluginId: string
): string | null {
  const surface = requireDestinationSurface(pluginId);
  const locationType = surface.normalizeLocationType(destination.locationType);
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
