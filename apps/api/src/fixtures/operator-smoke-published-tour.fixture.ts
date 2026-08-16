import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { Tour } from "../storage/tour-storage.interface";
import {
  DENALI_DEV_SMOKE_CATALOG_IDS,
  OPERATOR_SMOKE_CATALOG_IDS,
} from "../settings/seed-operator-smoke-catalog";

/** Phase 9.8 smoke — published multi-day tour (SMK-P9-ITIN-01, SMK-P9-07, DCAT-05). */
export const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210" as const;

/** Denali club dev host (…000003) — separate PK from operator smoke tour …0210 on …014. */
export const DENALI_CLUB_DEV_PUBLISHED_TOUR_ID =
  "00000000-0000-4000-8000-000000000220" as const;

/** Denali club draft — separate PK from operator draft …0211 (global tour id). */
export const DENALI_CLUB_DEV_DRAFT_TOUR_ID =
  "00000000-0000-4000-8000-000000000221" as const;

export const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211" as const;

/** Participant-requirements smoke — DEN-INTAKE E2E (nationalId + fatherName + birthDate). */
export const OPERATOR_SMOKE_PARTICIPANT_TOUR_ID = "00000000-0000-4000-8000-000000000212" as const;

export const OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE = "North Ridge Trek" as const;

/** Deterministic HTTPS cover — JSON-LD / catalog egress only emit https image URLs (not data:). */
export const OPERATOR_SMOKE_PUBLISHED_TOUR_COVER_URL =
  "https://cdn.example/operator-smoke-cover.jpg" as const;

export const OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE = "Alpine Identity Check" as const;

export const DENALI_CLUB_DEV_DRAFT_TOUR_TITLE = "Denali club draft fixture" as const;

/** Stable marker for P7-1-N-008 staging/catalog probes. */
export const OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT =
  "P7 staging: cancel 48h before departure for full refund." as const;

export type OperatorSmokePublishedTourCatalogRefs = {
  readonly destinationId: string;
  readonly themeId: string;
  /** Peak height meters — matrix-required for mountain tours. */
  readonly peakHeight: number;
};

export const OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG: OperatorSmokePublishedTourCatalogRefs =
  Object.freeze({
    destinationId: OPERATOR_SMOKE_CATALOG_IDS.destination,
    themeId: OPERATOR_SMOKE_CATALOG_IDS.theme,
    peakHeight: 3_962,
  });

export const DENALI_CLUB_DEV_PUBLISHED_TOUR_CATALOG: OperatorSmokePublishedTourCatalogRefs =
  Object.freeze({
    destinationId: DENALI_DEV_SMOKE_CATALOG_IDS.destination,
    themeId: DENALI_DEV_SMOKE_CATALOG_IDS.theme,
    peakHeight: 3_962,
  });

/** ED-SEED-01 — Jul 1→3 inclusive = 3 days; itinerary must carry 3 titled days. */
export function buildOperatorSmokePublishedTourItinerary(): readonly Record<string, unknown>[] {
  return [
    {
      dayNumber: 1,
      title: "Summit push",
      summary: "Early alpine start",
      segments: [
        {
          id: "smk-seg-1",
          kind: "activity",
          title: "Ridge ascent",
          startTime: "06:00",
          locationLabel: "North Ridge camp",
          photoIds: ["smk-photo-1"],
        },
      ],
    },
    {
      dayNumber: 2,
      title: "Return leg",
      summary: "Descent and camp breakdown",
      segments: [
        {
          id: "smk-seg-2",
          kind: "transport",
          title: "Descent to trailhead",
        },
      ],
    },
    {
      dayNumber: 3,
      title: "Departure buffer",
      summary: "Travel home / buffer day",
      segments: [
        {
          id: "smk-seg-3",
          kind: "transport",
          title: "Return transport",
        },
      ],
    },
  ];
}

/** ED-SEED-01 — inclusive span must stay 3 days to match itinerary day titles. */
export function resolveOperatorSmokePublishedTourWindow(
  now: Date = new Date()
): { readonly startDateTime: string; readonly endDateTime: string } {
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() + 14);
  start.setUTCHours(8, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 2);
  end.setUTCHours(18, 0, 0, 0);
  return {
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
  };
}

function buildSmokePublishedTourData(
  catalog: OperatorSmokePublishedTourCatalogRefs,
  now: Date = new Date()
): Record<string, unknown> {
  const window = resolveOperatorSmokePublishedTourWindow(now);
  return {
    title: OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE,
    publishStatus: "active",
    startDateTime: window.startDateTime,
    endDateTime: window.endDateTime,
    category: "mountain_multi",
    capacityMax: 12,
    destinationId: catalog.destinationId,
    program: {
      shortDescription: "Operator smoke catalog tour",
      difficultyLevel: 6,
      hikingHoursApprox: 8,
      themeIds: [catalog.themeId],
      itinerary: buildOperatorSmokePublishedTourItinerary(),
    },
    participants: { fitnessLevel: "medium", minimumAge: 16 },
    pricing: { basePricePerPerson: 2_500_000, paymentMode: "offline_receipt" },
    transport: { mode: "none" },
    photos: [
      {
        id: "smk-photo-1",
        url: OPERATOR_SMOKE_PUBLISHED_TOUR_COVER_URL,
        label: "Ridge panorama",
        day: 1,
      },
    ],
    policies: {
      policiesText: OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT,
      cancellationDeadlineHours: 48,
      cancellationPenaltyPercentage: 20,
    },
    tripDetails: {
      overview: {
        peakHeight: catalog.peakHeight,
        customServiceLabels: [],
      },
    },
    basics: { title: OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE },
    details: { summary: "Operator smoke seed tour" },
  };
}

function toCanonicalDocument(data: Record<string, unknown>): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: Object.keys(data),
    data,
  };
}

/**
 * Detects ED-SEED-01 seed debt: empty day titles after date-span sync, or missing catalog refs.
 */
export function isOperatorSmokePublishedTourEditReady(
  data: Readonly<Record<string, unknown>>,
  catalog: OperatorSmokePublishedTourCatalogRefs
): boolean {
  if (data.destinationId !== catalog.destinationId) {
    return false;
  }
  const participants = data.participants;
  if (
    participants == null ||
    typeof participants !== "object" ||
    Array.isArray(participants) ||
    (participants as { minimumAge?: unknown }).minimumAge !== 16
  ) {
    return false;
  }
  const tripDetails = data.tripDetails;
  const peak =
    tripDetails != null && typeof tripDetails === "object" && !Array.isArray(tripDetails)
      ? (tripDetails as { overview?: { peakHeight?: unknown } }).overview?.peakHeight
      : undefined;
  if (peak !== catalog.peakHeight) {
    return false;
  }
  const transport = data.transport;
  const mode =
    transport != null && typeof transport === "object" && !Array.isArray(transport)
      ? (transport as { mode?: unknown }).mode
      : undefined;
  if (typeof mode !== "string" || mode.trim().length === 0) {
    return false;
  }
  const pricing = data.pricing;
  const paymentMode =
    pricing != null && typeof pricing === "object" && !Array.isArray(pricing)
      ? (pricing as { paymentMode?: unknown }).paymentMode
      : undefined;
  if (typeof paymentMode !== "string" || paymentMode.trim().length === 0) {
    return false;
  }
  const program = data.program;
  const itinerary =
    program != null && typeof program === "object" && !Array.isArray(program)
      ? (program as { itinerary?: unknown }).itinerary
      : undefined;
  if (!Array.isArray(itinerary) || itinerary.length < 3) {
    return false;
  }
  for (const row of itinerary) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) {
      return false;
    }
    const title = (row as { title?: unknown }).title;
    if (typeof title !== "string" || title.trim().length === 0) {
      return false;
    }
  }
  return true;
}

/** Merge smoke publish-ready fields onto an existing canonical data bag (idempotent repair). */
export function applyOperatorSmokePublishedTourEditReadyPatch(
  data: Record<string, unknown>,
  catalog: OperatorSmokePublishedTourCatalogRefs
): Record<string, unknown> {
  const expected = buildSmokePublishedTourData(catalog);
  const next = structuredClone(data) as Record<string, unknown>;
  next.destinationId = expected.destinationId;
  next.startDateTime = expected.startDateTime;
  next.endDateTime = expected.endDateTime;
  next.category = expected.category;

  const program =
    next.program != null && typeof next.program === "object" && !Array.isArray(next.program)
      ? { ...(next.program as Record<string, unknown>) }
      : {};
  const expectedProgram = expected.program as Record<string, unknown>;
  program.themeIds = expectedProgram.themeIds;
  program.itinerary = expectedProgram.itinerary;
  if (typeof expectedProgram.shortDescription === "string") {
    program.shortDescription =
      typeof program.shortDescription === "string" && program.shortDescription.trim().length > 0
        ? program.shortDescription
        : expectedProgram.shortDescription;
  }
  if (program.difficultyLevel == null) {
    program.difficultyLevel = expectedProgram.difficultyLevel;
  }
  if (program.hikingHoursApprox == null) {
    program.hikingHoursApprox = expectedProgram.hikingHoursApprox;
  }
  next.program = program;

  const participants =
    next.participants != null &&
    typeof next.participants === "object" &&
    !Array.isArray(next.participants)
      ? { ...(next.participants as Record<string, unknown>) }
      : {};
  const expectedParticipants = expected.participants as Record<string, unknown>;
  participants.fitnessLevel = participants.fitnessLevel ?? expectedParticipants.fitnessLevel;
  participants.minimumAge = expectedParticipants.minimumAge;
  next.participants = participants;

  const tripDetails =
    next.tripDetails != null &&
    typeof next.tripDetails === "object" &&
    !Array.isArray(next.tripDetails)
      ? { ...(next.tripDetails as Record<string, unknown>) }
      : {};
  const overview =
    tripDetails.overview != null &&
    typeof tripDetails.overview === "object" &&
    !Array.isArray(tripDetails.overview)
      ? { ...(tripDetails.overview as Record<string, unknown>) }
      : {};
  const expectedOverview = (expected.tripDetails as { overview: Record<string, unknown> }).overview;
  overview.peakHeight = expectedOverview.peakHeight;
  overview.customServiceLabels = overview.customServiceLabels ?? expectedOverview.customServiceLabels;
  tripDetails.overview = overview;
  next.tripDetails = tripDetails;

  const expectedTransport = expected.transport as Record<string, unknown>;
  const transport =
    next.transport != null && typeof next.transport === "object" && !Array.isArray(next.transport)
      ? { ...(next.transport as Record<string, unknown>) }
      : {};
  if (typeof transport.mode !== "string" || transport.mode.trim().length === 0) {
    transport.mode = expectedTransport.mode;
  }
  next.transport = transport;

  const expectedPricing = expected.pricing as Record<string, unknown>;
  const pricing =
    next.pricing != null && typeof next.pricing === "object" && !Array.isArray(next.pricing)
      ? { ...(next.pricing as Record<string, unknown>) }
      : {};
  if (pricing.basePricePerPerson == null) {
    pricing.basePricePerPerson = expectedPricing.basePricePerPerson;
  }
  if (typeof pricing.paymentMode !== "string" || pricing.paymentMode.trim().length === 0) {
    pricing.paymentMode = expectedPricing.paymentMode;
  }
  next.pricing = pricing;

  return next;
}

export function buildOperatorSmokePublishedTourCanonical(
  catalog: OperatorSmokePublishedTourCatalogRefs = OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG
): CanonicalDocument {
  return toCanonicalDocument(buildSmokePublishedTourData(catalog));
}

export function buildOperatorSmokePublishedTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  return {
    id: OPERATOR_SMOKE_SEED_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(0).toISOString(),
    canonical: buildOperatorSmokePublishedTourCanonical(OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG),
  };
}

/** Denali club dev catalog — same shape as operator smoke, tenant-scoped tour id + denali catalog refs. */
export function buildDenaliClubDevPublishedTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  return {
    id: DENALI_CLUB_DEV_PUBLISHED_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(0).toISOString(),
    canonical: buildOperatorSmokePublishedTourCanonical(DENALI_CLUB_DEV_PUBLISHED_TOUR_CATALOG),
  };
}

export function buildDenaliClubDevDraftTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  const data: Record<string, unknown> = {
    title: DENALI_CLUB_DEV_DRAFT_TOUR_TITLE,
    publishStatus: "draft",
  };
  return {
    id: DENALI_CLUB_DEV_DRAFT_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(1).toISOString(),
    canonical: toCanonicalDocument(data),
  };
}

export function buildOperatorSmokeParticipantRequirementsTourCanonical(): CanonicalDocument {
  const base = buildOperatorSmokePublishedTourCanonical();
  return toCanonicalDocument({
    ...base.data,
    title: OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE,
    basics: { title: OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE },
    participantRequirements: {
      nationalIdRequired: true,
      fatherNameRequired: true,
      birthDateRequired: true,
    },
  });
}

export function buildOperatorSmokeParticipantRequirementsTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  return {
    id: OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(2).toISOString(),
    canonical: buildOperatorSmokeParticipantRequirementsTourCanonical(),
  };
}

/** Transport smoke — bus with personal-car opt-in (DEN-TRANS-01/02). */
export const OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID = "00000000-0000-4000-8000-000000000213" as const;

export const OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE = "Ridge Bus Shuttle" as const;

/** Transport smoke — shared_cars with mandatory dong follow-up (DEN-TRANS-03). */
export const OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID =
  "00000000-0000-4000-8000-000000000214" as const;

export const OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE = "Carpool Pass" as const;

export function buildOperatorSmokeTransportBusTourCanonical(): CanonicalDocument {
  const base = buildOperatorSmokePublishedTourCanonical();
  return toCanonicalDocument({
    ...base.data,
    title: OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE,
    basics: { title: OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE },
    transport: {
      mode: "bus",
      allowPersonalCar: true,
      transportCost: 150_000,
    },
  });
}

export function buildOperatorSmokeTransportBusTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  return {
    id: OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(3).toISOString(),
    canonical: buildOperatorSmokeTransportBusTourCanonical(),
  };
}

export function buildOperatorSmokeTransportSharedCarsTourCanonical(): CanonicalDocument {
  const base = buildOperatorSmokePublishedTourCanonical();
  return toCanonicalDocument({
    ...base.data,
    title: OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE,
    basics: { title: OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE },
    transport: {
      mode: "shared_cars",
      dongAmount: 80_000,
    },
  });
}

export function buildOperatorSmokeTransportSharedCarsTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  return {
    id: OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(4).toISOString(),
    canonical: buildOperatorSmokeTransportSharedCarsTourCanonical(),
  };
}

export function buildOperatorSmokeDraftTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  const data: Record<string, unknown> = {
    title: "Denali draft fixture",
    publishStatus: "draft",
  };
  return {
    id: OPERATOR_SMOKE_DRAFT_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(1).toISOString(),
    canonical: toCanonicalDocument(data),
  };
}
