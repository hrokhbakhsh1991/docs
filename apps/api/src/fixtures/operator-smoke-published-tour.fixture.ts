import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { Tour } from "../storage/tour-storage.interface";

/** Phase 9.8 smoke — published multi-day tour (SMK-P9-ITIN-01, SMK-P9-07, DCAT-05). */
export const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210" as const;

export const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211" as const;

export const OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE = "North Ridge Trek" as const;

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
