import {
  normalizeLegacyOverviewTripStyleToTripStyles,
  normalizeTourFormProfileInput,
  type DifficultyLevel,
  type TourDetailsDto,
  type TourDto,
  type TourItineraryItem,
  type TourLifecycleStatus,
} from "@repo/types";

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

  const rawItinerary: unknown = o.itinerary;
  const itinerary = Array.isArray(rawItinerary)
    ? rawItinerary
        .map((item: unknown) => normalizeItineraryItem(item))
        .filter((item): item is TourItineraryItem => item !== null)
    : undefined;

  let tripDetailsRaw: unknown = o.tripDetails ?? o.trip_details;
  if (tripDetailsRaw != null && typeof tripDetailsRaw === "object" && !Array.isArray(tripDetailsRaw)) {
    const td = JSON.parse(JSON.stringify(tripDetailsRaw)) as Record<string, unknown>;
    normalizeLegacyOverviewTripStyleToTripStyles(td);
    tripDetailsRaw = td;
  }

  return {
    destinationName: normalizeOptionalString(o.destinationName ?? o.destination_name) ?? undefined,
    elevationM: normalizeOptionalNumber(o.elevationM ?? o.elevation_m) ?? undefined,
    difficulty: normalizeDifficulty(o.difficulty) ?? undefined,
    durationDays: normalizeOptionalNumber(o.durationDays ?? o.duration_days) ?? undefined,
    meetingPoint: normalizeOptionalString(o.meetingPoint ?? o.meeting_point) ?? undefined,
    ...(itinerary != null && itinerary.length > 0 ? { itinerary } : {}),
    ...(tripDetailsRaw != null && typeof tripDetailsRaw === "object" && !Array.isArray(tripDetailsRaw)
      ? { tripDetails: tripDetailsRaw as Record<string, unknown> }
      : {}),
  };
}

const TOUR_TRANSPORT_MODE_SLUGS = new Set(["bus", "train", "plane", "private_car"]);

type TourTransportModeSlug = TourDto["transportModes"][number];

/** Maps new `transportModes` array or legacy single `primaryTransportMode` enum. */
function normalizeTransportModesRow(o: Record<string, unknown>): TourDto["transportModes"] {
  const multi = o.transportModes ?? o.transport_modes;
  if (Array.isArray(multi)) {
    const out: TourTransportModeSlug[] = [];
    for (const x of multi) {
      const v = String(x).trim().toLowerCase();
      if (TOUR_TRANSPORT_MODE_SLUGS.has(v)) out.push(v as TourTransportModeSlug);
    }
    return [...new Set(out)].sort() as TourDto["transportModes"];
  }
  const legacy = o.primaryTransportMode ?? o.primary_transport_mode;
  if (legacy == null || legacy === "") return [];
  const v = String(legacy).trim().toLowerCase();
  if (v === "mixed") {
    return (["bus", "train", "plane", "private_car"] as TourTransportModeSlug[]).slice().sort() as TourDto["transportModes"];
  }
  if (v === "none") return [];
  if (TOUR_TRANSPORT_MODE_SLUGS.has(v)) return [v as TourTransportModeSlug];
  return [];
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
    transportModes: normalizeTransportModesRow(o),
    formProfileSnapshot: (() => {
      const snapRaw = o.formProfileSnapshot ?? o.form_profile_snapshot;
      if (snapRaw == null || (typeof snapRaw === "string" && snapRaw.trim() === "")) {
        return null;
      }
      return normalizeTourFormProfileInput(snapRaw);
    })(),
    destinationId: normalizeOptionalString(o.destinationId ?? o.destination_id),
    destinationName: normalizeOptionalString(o.destinationName ?? o.destination_name),
    destinationRegionName: normalizeOptionalString(
      o.destinationRegionName ?? o.destination_region_name,
    ),
    details: normalizeTourDetails(o.details),
    /** UI/forms legacy alias — same resolved value as `chatLink`. */
    communicationLink: link,
    createdAt: String(o.createdAt ?? ""),
    updatedAt: String(o.updatedAt ?? ""),
  };

  return tour;
}
