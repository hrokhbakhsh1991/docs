import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { Tour } from "../storage/tour-storage.interface";

/** Phase 9.8 smoke — published multi-day tour (SMK-P9-ITIN-01, SMK-P9-07, DCAT-05). */
export const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210" as const;

/** Denali club dev host (…000003) — separate PK from operator smoke tour …0210 on …014. */
export const DENALI_CLUB_DEV_PUBLISHED_TOUR_ID =
  "00000000-0000-4000-8000-000000000220" as const;

export const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211" as const;

/** Participant-requirements smoke — DEN-INTAKE E2E (nationalId + fatherName + birthDate). */
export const OPERATOR_SMOKE_PARTICIPANT_TOUR_ID = "00000000-0000-4000-8000-000000000212" as const;

export const OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE = "North Ridge Trek" as const;

export const OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE = "Alpine Identity Check" as const;

/** Stable marker for P7-1-N-008 staging/catalog probes. */
export const OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT =
  "P7 staging: cancel 48h before departure for full refund." as const;

export function buildOperatorSmokePublishedTourCanonical(): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["basics"],
    data: {
      title: OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE,
      publishStatus: "active",
      startDateTime: "2026-07-01T08:00:00.000Z",
      endDateTime: "2026-07-03T18:00:00.000Z",
      category: "mountain_multi",
      capacityMax: 12,
      program: {
        shortDescription: "Operator smoke catalog tour",
        difficultyLevel: 6,
        hikingHoursApprox: 8,
        itinerary: [
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
            segments: [
              {
                id: "smk-seg-2",
                kind: "transport",
                title: "Descent to trailhead",
              },
            ],
          },
        ],
      },
      participants: { fitnessLevel: "medium" },
      pricing: { basePricePerPerson: 2_500_000 },
      photos: [
        {
          id: "smk-photo-1",
          url: "https://cdn.example/north-ridge.jpg",
          label: "Ridge panorama",
          day: 1,
        },
      ],
      policies: {
        policiesText: OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT,
        cancellationDeadlineHours: 48,
        cancellationPenaltyPercentage: 20,
      },
      basics: { title: OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE },
      details: { summary: "Operator smoke seed tour" },
    },
  };
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
    canonical: buildOperatorSmokePublishedTourCanonical(),
  };
}

/** Denali club dev catalog — same canonical as operator smoke, tenant-scoped tour id. */
export function buildDenaliClubDevPublishedTour(input: {
  readonly tenantId: string;
  readonly createdAt?: string;
}): Tour {
  return {
    ...buildOperatorSmokePublishedTour(input),
    id: DENALI_CLUB_DEV_PUBLISHED_TOUR_ID,
  };
}

export function buildOperatorSmokeParticipantRequirementsTourCanonical(): CanonicalDocument {
  return {
    ...buildOperatorSmokePublishedTourCanonical(),
    data: {
      ...buildOperatorSmokePublishedTourCanonical().data,
      title: OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE,
      basics: { title: OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE },
      participantRequirements: {
        nationalIdRequired: true,
        fatherNameRequired: true,
        birthDateRequired: true,
      },
    },
  };
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
  return {
    ...buildOperatorSmokePublishedTourCanonical(),
    data: {
      ...buildOperatorSmokePublishedTourCanonical().data,
      title: OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE,
      basics: { title: OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE },
      transport: {
        transportMode: "bus",
        allowPersonalCar: true,
        transportCost: 150_000,
      },
    },
  };
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
  return {
    ...buildOperatorSmokePublishedTourCanonical(),
    data: {
      ...buildOperatorSmokePublishedTourCanonical().data,
      title: OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE,
      basics: { title: OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE },
      transport: {
        transportMode: "shared_cars",
        dongAmount: 80_000,
      },
    },
  };
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
  return {
    id: OPERATOR_SMOKE_DRAFT_TOUR_ID,
    tenantId: input.tenantId,
    rowVersion: 1,
    createdAt: input.createdAt ?? new Date(1).toISOString(),
    canonical: {
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        title: "Denali draft fixture",
        publishStatus: "draft",
      },
    },
  };
}
