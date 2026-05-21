import assert from "node:assert/strict";
import test from "node:test";

import { ToursCloneService } from "../../../src/modules/tours/services/tours-clone.service";
import type { TourTripDetails } from "../../../src/modules/tours/types/tour-trip-details.types";

test("ToursCloneService.cloneTripDetailsForWizard preserves 5-zone pins and itinerary geo", () => {
  const service = new ToursCloneService();
  const source = {
    overview: {
      denaliTourKind: "mountain_multi",
      leaderUserIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      localGuideName: "Guide Ali",
      gatheringPoint: { addressText: "Tehran", latitude: 35.7, longitude: 51.4 },
      startPoint: { addressText: "Rineh", latitude: 35.9, longitude: 52.1 },
      summitPoint: { addressText: "Summit", latitude: 35.95, longitude: 52.11 },
      campPoint: { addressText: "Camp", latitude: 35.92, longitude: 52.05 },
      endPoint: { addressText: "Return", latitude: 35.7, longitude: 51.4 },
      difficultyLevel: 6,
      tourThemeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
      shortIntro: "Short",
    },
    itinerary: {
      dayPlans: [
        {
          day: 1,
          title: "Day stop",
          description: "Hike",
          location: { addressText: "Trail", latitude: 36, longitude: 52.2 },
          photos: [
            {
              id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
              url: "https://example.com/d1.jpg",
              filename: "d1.jpg",
              size: 100,
              mimeType: "image/jpeg",
              uploadedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      ],
    },
    photos: [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        url: "https://example.com/tour.jpg",
        filename: "tour.jpg",
        size: 200,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as TourTripDetails;

  const cloned = service.cloneTripDetailsForWizard(source);
  assert.ok(cloned);
  assert.deepEqual(cloned!.overview?.leaderUserIds, source.overview?.leaderUserIds);
  assert.equal(cloned!.overview?.localGuideName, "Guide Ali");
  assert.equal(cloned!.overview?.gatheringPoint?.latitude, 35.7);
  assert.equal(cloned!.itinerary?.dayPlans?.[0]?.location?.longitude, 52.2);
  assert.equal(cloned!.itinerary?.dayPlans?.[0]?.photos?.length, 1);
  assert.equal(cloned!.photos?.length, 1);
  assert.notEqual(cloned!.overview?.gatheringPoint, source.overview?.gatheringPoint);
});

test("ToursCloneService.tripDetailsToDenaliPresetDefaults maps nested itinerary location", () => {
  const service = new ToursCloneService();
  const defaults = service.tripDetailsToDenaliPresetDefaults({
    overview: {
      denaliTourKind: "mountain_day",
      gatheringPoint: { addressText: "Meet", latitude: 1, longitude: 2 },
      tourThemeIds: [],
      shortIntro: "x",
    },
    itinerary: {
      dayPlans: [
        {
          day: 1,
          title: "Stop",
          description: "Walk",
          location: { addressText: "Stop", latitude: 3, longitude: 4 },
        },
      ],
    },
  } as TourTripDetails);
  const program = defaults.programNature as { itinerary?: Array<{ location?: { latitude?: number } }> };
  assert.equal(program.itinerary?.[0]?.location?.latitude, 3);
  const basic = defaults.basicInfo as { gatheringPoint?: { latitude?: number } };
  assert.equal(basic.gatheringPoint?.latitude, 1);
});
