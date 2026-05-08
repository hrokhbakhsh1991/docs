import type { DifficultyLevel, TourDetailsDto, TourDto, TourLifecycleStatus, TourItineraryItem } from "@repo/types";

import type { TourDetailDto } from "../services/tours.service";

const LIFECYCLE_VALUES = new Set<TourLifecycleStatus>(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);

function normalizeLifecycle(value: unknown): TourLifecycleStatus {
  const raw = String(value ?? "").trim().toUpperCase();
  if (LIFECYCLE_VALUES.has(raw as TourLifecycleStatus)) {
    return raw as TourLifecycleStatus;
  }
  return "DRAFT";
}

function normalizeOptionalString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function pickFirstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeCostContext(value: unknown): Record<string, unknown> | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeDifficulty(value: unknown): DifficultyLevel | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "easy" || raw === "moderate" || raw === "hard" || raw === "technical") {
    return raw;
  }
  return null;
}

function normalizeItineraryItem(value: unknown): TourItineraryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const day = normalizeOptionalNumber(item.day);
  if (day == null) return null;
  return {
    day,
    title: normalizeOptionalString(item.title) ?? "",
    description: normalizeOptionalString(item.description),
    distanceKm: normalizeOptionalNumber(item.distanceKm ?? item.distance_km),
    elevationGainM: normalizeOptionalNumber(item.elevationGainM ?? item.elevation_gain_m),
  };
}

function normalizeTourDetails(value: unknown): TourDetailsDto | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;

  const requiredGear = Array.isArray(o.requiredGear ?? o.required_gear)
    ? (o.requiredGear ?? o.required_gear)
        .map((v) => normalizeOptionalString(v))
        .filter((v): v is string => Boolean(v))
    : null;

  const rawItinerary = o.itinerary;
  const itinerary = Array.isArray(rawItinerary)
    ? rawItinerary
        .map((item) => normalizeItineraryItem(item))
        .filter((item): item is TourItineraryItem => item !== null)
    : null;

  return {
    destinationName: normalizeOptionalString(o.destinationName ?? o.destination_name),
    elevationM: normalizeOptionalNumber(o.elevationM ?? o.elevation_m),
    difficulty: normalizeDifficulty(o.difficulty),
    durationDays: normalizeOptionalNumber(o.durationDays ?? o.duration_days),
    meetingPoint: normalizeOptionalString(o.meetingPoint ?? o.meeting_point),
    requiredGear,
    itinerary,
  };
}

/**
 * Maps a loose JSON row from `GET /api/v2/tours` (serialized entity + OpenAPI fields)
 * into {@link TourDto} + `lifecycleStatus` for list/detail UI.
 */
export function mapTourResponseToDto(raw: unknown): TourDetailDto {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid tour payload");
  }
  const o = raw as Record<string, unknown>;

  const link = pickFirstNonEmptyString(
    o.chatLink,
    o.chat_link,
    o.communicationLink,
    o.communication_link,
    o.communication_link_url,
    o.communicationUrl
  );

  const lifecycleStatus = normalizeLifecycle(o.lifecycleStatus ?? o.lifecycle_status);

  const tour: TourDto = {
    id: String(o.id ?? ""),
    title: String(o.title ?? ""),
    description: o.description == null ? null : String(o.description),
    totalCapacity: num(o.totalCapacity ?? o.total_capacity),
    acceptedCount: num(o.acceptedCount ?? o.accepted_count),
    costContext: normalizeCostContext(o.costContext ?? o.cost_context),
    lifecycleStatus,
    chatLink: link,
    autoAcceptRegistrations:
      typeof (o.autoAcceptRegistrations ?? o.auto_accept_registrations) === "boolean"
        ? Boolean(o.autoAcceptRegistrations ?? o.auto_accept_registrations)
        : null,
    tourType:
      o.tourType == null
        ? null
        : (String(o.tourType).trim().toLowerCase() as TourDto["tourType"]),
    primaryTransportMode:
      o.primaryTransportMode == null
        ? null
        : (String(o.primaryTransportMode).trim().toLowerCase() as TourDto["primaryTransportMode"]),
    details: normalizeTourDetails(o.details),
    /** UI/forms legacy alias — same resolved value as `chatLink`. */
    communicationLink: link,
    createdAt: String(o.createdAt ?? ""),
    updatedAt: String(o.updatedAt ?? ""),
  };

  return tour;
}
