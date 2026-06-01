import { getDenaliFormPathValue, setDenaliFormPathValue } from "../adapters/denaliFormPathUtils";
import { mapDenaliCanonicalToFormPath } from "../rules/denaliCanonicalPaths";
import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
  type DenaliFieldWireProjection,
} from "../registry/DenaliFieldRegistry";
import { resetWizardToRegistryDefaults } from "../draft/resetWizardToRegistryDefaults";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";

/** Persisted `trip_details.participation` field aliases for canonical `participants.*` paths. */
const PARTICIPATION_CANONICAL_TO_TRIP_DETAILS_FIELD: Readonly<Record<string, string>> = {
  nationalIdRequired: "registrationNationalIdRequired",
};

/** Persisted `trip_details.policies` field aliases for canonical `policies.*` paths. */
const POLICIES_CANONICAL_TO_TRIP_DETAILS_FIELD: Readonly<Record<string, string>> = {
  policiesText: "cancellationPolicy",
};

export type BuildDenaliClonePresetOptions = {
  storagePaths: readonly string[];
};

function getNestedValue(root: unknown, dotPath: string): unknown {
  const segments = dotPath.split(".").filter(Boolean);
  let current: unknown = root;
  for (const segment of segments) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function findRegistryEntry(storagePath: string): DenaliFieldDefinition | undefined {
  return (
    DENALI_FIELD_DEFINITIONS.find((row) => row.canonicalPath === storagePath) ??
    DENALI_FIELD_DEFINITIONS.find((row) => row.canonicalPath === `tripDetails.${storagePath}`)
  );
}

function listTripDetailsWires(entry: DenaliFieldDefinition): DenaliFieldWireProjection[] {
  const wire = entry.wire;
  if (!wire) {
    return [];
  }
  return Array.isArray(wire) ? [...wire] : [wire as DenaliFieldWireProjection];
}

function pickTripDetailsWire(entry: DenaliFieldDefinition): DenaliFieldWireProjection | undefined {
  return listTripDetailsWires(entry).find((wire) => wire.kind.startsWith("tripDetails"));
}

function readViaWire(tripDetails: Record<string, unknown>, wire: DenaliFieldWireProjection): unknown {
  switch (wire.kind) {
    case "tripDetails.overview":
      return getNestedValue(tripDetails.overview, wire.field);
    case "tripDetails.logistics":
      return getNestedValue(tripDetails.logistics, wire.field);
    case "tripDetails.participation":
      return getNestedValue(tripDetails.participation, wire.field);
    case "tripDetails.metrics":
      return getNestedValue(tripDetails.metrics, wire.field);
    case "tripDetails":
      if (wire.field === "photos") {
        return tripDetails.photos;
      }
      if (wire.field === "transport") {
        return tripDetails.transport;
      }
      return tripDetails[wire.field];
    default:
      return undefined;
  }
}

function readCloneSourceValue(
  tripDetails: Record<string, unknown>,
  storagePath: string,
  entry: DenaliFieldDefinition | undefined,
): unknown {
  if (storagePath === "program.itinerary") {
    const dayPlans = getNestedValue(tripDetails.itinerary, "dayPlans");
    return Array.isArray(dayPlans) ? dayPlans : undefined;
  }

  if (storagePath.startsWith("tripDetails.")) {
    return getNestedValue(tripDetails, storagePath.slice("tripDetails.".length));
  }

  if (storagePath.startsWith("participants.")) {
    const canonicalField = storagePath.slice("participants.".length);
    const tripField =
      PARTICIPATION_CANONICAL_TO_TRIP_DETAILS_FIELD[canonicalField] ?? canonicalField;
    return getNestedValue(tripDetails.participation, tripField);
  }

  if (storagePath.startsWith("policies.")) {
    const canonicalField = storagePath.slice("policies.".length);
    const tripField = POLICIES_CANONICAL_TO_TRIP_DETAILS_FIELD[canonicalField] ?? canonicalField;
    return getNestedValue(tripDetails.policies, tripField);
  }

  if (storagePath.startsWith("metrics.")) {
    return getNestedValue(tripDetails.metrics, storagePath.slice("metrics.".length));
  }

  if (storagePath === "category") {
    return getNestedValue(tripDetails.overview, "denaliTourKind");
  }

  if (storagePath === "program.themeIds") {
    return getNestedValue(tripDetails.overview, "tourThemeIds");
  }

  if (storagePath === "program.shortDescription") {
    return getNestedValue(tripDetails.overview, "shortIntro");
  }

  if (entry) {
    const wire = pickTripDetailsWire(entry);
    if (wire) {
      return readViaWire(tripDetails, wire);
    }
  }

  return undefined;
}

function transformCloneValueForForm(canonicalPath: string, raw: unknown): unknown {
  if (canonicalPath === "program.itinerary" && Array.isArray(raw)) {
    return raw.map((row, index) => {
      const plan = row as Record<string, unknown>;
      const day =
        typeof plan.day === "number" && Number.isFinite(plan.day) ? plan.day : index + 1;
      const title = typeof plan.title === "string" ? plan.title : "";
      const description =
        typeof plan.description === "string" ? plan.description : "";
      return {
        day,
        locationText: title || undefined,
        activities: description,
        ...(plan.location && typeof plan.location === "object" ? { location: plan.location } : {}),
        ...(Array.isArray(plan.photos) && plan.photos.length > 0 ? { photos: plan.photos } : {}),
      };
    });
  }

  if (canonicalPath === "transport.mode" && typeof raw === "string") {
    return raw;
  }

  if (canonicalPath === "transport.mode" && raw != null && typeof raw === "object") {
    return undefined;
  }

  return raw;
}

function isEmptyCloneValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string" && value.trim() === "") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

/**
 * Walks Layer C storage paths and copies matching values from persisted `trip_details`
 * into a wizard form preset (registry form paths via {@link mapDenaliCanonicalToFormPath}).
 */
export function buildDenaliClonePresetFromTripDetails(
  tripDetails: Record<string, unknown>,
  options: BuildDenaliClonePresetOptions,
): DenaliCreateTourWizardForm {
  const form = resetWizardToRegistryDefaults();

  for (const storagePath of options.storagePaths) {
    const entry = findRegistryEntry(storagePath);
    const canonicalPath = entry?.canonicalPath ?? storagePath;
    const raw = readCloneSourceValue(tripDetails, storagePath, entry);
    if (isEmptyCloneValue(raw)) {
      continue;
    }
    const value = transformCloneValueForForm(canonicalPath, raw);
    if (isEmptyCloneValue(value)) {
      continue;
    }
    const formPath = mapDenaliCanonicalToFormPath(canonicalPath);
    setDenaliFormPathValue(form, formPath, value);
  }

  return form;
}

/** @internal Test helper — reads a preset field after walking storage paths. */
export function readDenaliClonePresetFormPath(
  tripDetails: Record<string, unknown>,
  options: BuildDenaliClonePresetOptions & { formPath: string },
): unknown {
  const preset = buildDenaliClonePresetFromTripDetails(tripDetails, options);
  return getDenaliFormPathValue(preset, options.formPath);
}
