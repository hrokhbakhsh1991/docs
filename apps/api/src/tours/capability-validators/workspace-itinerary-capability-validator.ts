import { getWorkspaceItineraryCapabilities } from "@app-tour/workspace-sdk";
import type {
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

import { isRecord, readCanonicalPath, readFiniteNumber, readNonEmptyString } from "./canonical-path.ts";

const ITINERARY_CANONICAL_PATH = "program.itinerary";

function validateItinerarySegment(segment: unknown, dayIndex: number, segmentIndex: number): WorkspaceViolation | null {
  if (!isRecord(segment)) {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: `program.itinerary[${dayIndex}].segments[${segmentIndex}] must be an object`,
    };
  }

  if (readNonEmptyString(segment.title) == null) {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: `program.itinerary[${dayIndex}].segments[${segmentIndex}].title must be a non-empty string`,
    };
  }

  if (segment.kind !== undefined && typeof segment.kind !== "string") {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: `program.itinerary[${dayIndex}].segments[${segmentIndex}].kind must be a string when present`,
    };
  }

  return null;
}

function validateItineraryDay(day: unknown, dayIndex: number): WorkspaceViolation | null {
  if (!isRecord(day)) {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: `program.itinerary[${dayIndex}] must be an object`,
    };
  }

  const dayNumber = readFiniteNumber(day.dayNumber);
  if (dayNumber == null || !Number.isInteger(dayNumber) || dayNumber < 1) {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: `program.itinerary[${dayIndex}].dayNumber must be a positive integer when present`,
    };
  }

  if (readNonEmptyString(day.title) == null) {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: `program.itinerary[${dayIndex}].title must be a non-empty string`,
    };
  }

  const segments = day.segments;
  if (segments === undefined) {
    return null;
  }

  if (!Array.isArray(segments)) {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: `program.itinerary[${dayIndex}].segments must be an array when present`,
    };
  }

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const violation = validateItinerarySegment(segments[segmentIndex], dayIndex, segmentIndex);
    if (violation != null) {
      return violation;
    }
  }

  return null;
}

/** MAT-002 — generic itinerary capability structural validation (CW7-10). */
export function validateWorkspaceItineraryCapability(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  const capabilities = getWorkspaceItineraryCapabilities(ctx.workspaceType);
  if (capabilities == null || capabilities.wizardTourField !== true) {
    return null;
  }

  const data = ctx.document.data as Record<string, unknown>;
  const rawItinerary = readCanonicalPath(data, ITINERARY_CANONICAL_PATH);
  if (rawItinerary === undefined) {
    return null;
  }

  if (!Array.isArray(rawItinerary)) {
    return {
      code: "WORKSPACE_ITINERARY_INVALID",
      message: "program.itinerary must be an array when present",
    };
  }

  for (let dayIndex = 0; dayIndex < rawItinerary.length; dayIndex += 1) {
    const violation = validateItineraryDay(rawItinerary[dayIndex], dayIndex);
    if (violation != null) {
      return violation;
    }
  }

  return null;
}
