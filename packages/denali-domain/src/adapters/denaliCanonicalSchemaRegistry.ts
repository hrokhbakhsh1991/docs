import type { DenaliCanonicalTourModel } from "@repo/types/denali";

type DenaliStringFieldPolicy = "required" | "optional";

type DenaliCanonicalStringSchema = Record<string, DenaliStringFieldPolicy>;

/**
 * Centralized string normalization policy for Denali canonical model.
 * Keeps trim/coercion behavior in one schema-like registry.
 */
const DENALI_CANONICAL_STRING_SCHEMA: DenaliCanonicalStringSchema = {
  title: "required",
  destinationId: "required",
  startDateTime: "required",
  endDateTime: "optional",
  startPointLocationText: "optional",
  socialMediaLink: "optional",
  approximateReturnTime: "optional",
  localGuideName: "optional",
  "program.shortDescription": "required",
  "program.longDescription": "optional",
  "transport.transportNotes": "optional",
  "participants.fitnessPrerequisiteText": "optional",
  "policies.policiesText": "optional",
};

function readCanonicalSchemaPolicy(path: string): DenaliStringFieldPolicy {
  return DENALI_CANONICAL_STRING_SCHEMA[path] ?? "optional";
}

export function denaliCanonicalTrimmedString(path: string, value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (readCanonicalSchemaPolicy(path) === "required") {
    return trimmed;
  }
  return trimmed;
}

export function denaliCanonicalOptionalTrimmedString(path: string, value: unknown): string | undefined {
  const trimmed = denaliCanonicalTrimmedString(path, value);
  return trimmed === "" ? undefined : trimmed;
}

function sanitizeDenaliCanonicalGatheringPoints(
  points: DenaliCanonicalTourModel["gatheringPoints"],
): DenaliCanonicalTourModel["gatheringPoints"] {
  if (!Array.isArray(points) || points.length === 0) return undefined;
  return points.map((station) => ({
    ...station,
    id: denaliCanonicalOptionalTrimmedString("gatheringPoints.id", station?.id),
    title: denaliCanonicalTrimmedString("gatheringPoints.title", station?.title),
    time: denaliCanonicalOptionalTrimmedString("gatheringPoints.time", station?.time),
  }));
}

function sanitizeDenaliCanonicalItinerary(
  itinerary: DenaliCanonicalTourModel["program"]["itinerary"],
): DenaliCanonicalTourModel["program"]["itinerary"] {
  if (!Array.isArray(itinerary) || itinerary.length === 0) return itinerary;
  return itinerary.map((row) => ({
    ...row,
    activities: denaliCanonicalTrimmedString("program.itinerary.activities", row?.activities),
    locationText: denaliCanonicalOptionalTrimmedString(
      "program.itinerary.locationText",
      row?.locationText,
    ),
  }));
}

export function sanitizeDenaliCanonicalModel(
  model: DenaliCanonicalTourModel,
): DenaliCanonicalTourModel {
  return {
    ...model,
    title: denaliCanonicalTrimmedString("title", model.title),
    destinationId: denaliCanonicalTrimmedString("destinationId", model.destinationId),
    startDateTime: denaliCanonicalTrimmedString("startDateTime", model.startDateTime),
    endDateTime: denaliCanonicalOptionalTrimmedString("endDateTime", model.endDateTime),
    startPointLocationText: denaliCanonicalOptionalTrimmedString(
      "startPointLocationText",
      model.startPointLocationText,
    ),
    socialMediaLink: denaliCanonicalOptionalTrimmedString("socialMediaLink", model.socialMediaLink),
    approximateReturnTime: denaliCanonicalOptionalTrimmedString(
      "approximateReturnTime",
      model.approximateReturnTime,
    ),
    localGuideName: denaliCanonicalOptionalTrimmedString("localGuideName", model.localGuideName),
    gatheringPoints: sanitizeDenaliCanonicalGatheringPoints(model.gatheringPoints),
    program: {
      ...model.program,
      shortDescription: denaliCanonicalTrimmedString(
        "program.shortDescription",
        model.program.shortDescription,
      ),
      longDescription: denaliCanonicalOptionalTrimmedString(
        "program.longDescription",
        model.program.longDescription,
      ),
      itinerary: sanitizeDenaliCanonicalItinerary(model.program.itinerary),
    },
    transport: {
      ...model.transport,
      transportNotes: denaliCanonicalOptionalTrimmedString(
        "transport.transportNotes",
        model.transport.transportNotes,
      ),
    },
    participants: {
      ...model.participants,
      fitnessPrerequisiteText: denaliCanonicalOptionalTrimmedString(
        "participants.fitnessPrerequisiteText",
        model.participants.fitnessPrerequisiteText,
      ),
    },
    policies: {
      ...model.policies,
      policiesText: denaliCanonicalOptionalTrimmedString(
        "policies.policiesText",
        model.policies.policiesText,
      ),
    },
  };
}
