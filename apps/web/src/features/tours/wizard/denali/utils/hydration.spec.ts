import assert from "node:assert/strict";
import test from "node:test";

import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";

function makeSavedApiTour(
  elevationGainMeters: number = 1_100,
): TourCloneSourceDto {
  return {
    title: "Hydration refresh cycle",
    description: "Persisted tour payload from DB",
    tourType: "mountain",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    costContext: { totalCost: 500_000, requiresPayment: true },
    details: {
      tripDetails: {
        overview: {
          denaliTourKind: "mountain_day",
          shortIntro: "short intro",
          elevationGainMeters,
        },
        logistics: {
          departureDate: "2026-08-10",
          departureMeetingTime: "08:30",
          groupSizeMax: 12,
          meetingPoint: "Tehran",
        },
        itinerary: {},
        participation: {},
        policies: {},
      },
    },
  };
}

test("refresh cycle: hydrates overview.elevationGainMeters into tripDetails.metrics.elevationGain", () => {
  const apiTour = makeSavedApiTour(850);

  const hydrated = transformTourToDenaliWizardValues(apiTour, { mode: "clone" });

  assert.equal(
    hydrated.tripDetails?.metrics?.elevationGain,
    850,
    "hydrate must map API tripDetails.overview.elevationGainMeters to RHF tripDetails.metrics.elevationGain",
  );
});
