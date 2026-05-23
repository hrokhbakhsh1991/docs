import assert from "node:assert/strict";
import test from "node:test";

import { transformTourToDenaliWizardValues } from "./transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "./transformTourToWizardValues";

function makeApiTour(overrides: Partial<TourCloneSourceDto> = {}): TourCloneSourceDto {
  return {
    title: "abcdefghijklmnop",
    description: "long desc",
    tourType: "mountain",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    costContext: { totalCost: 500_000, requiresPayment: true },
    transportModes: ["bus", "private_car"],
    details: {
      tripDetails: {
        overview: {
          denaliTourKind: "mountain_day",
          shortIntro: "short",
          tourThemeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
          difficultyLevel: 5.5,
        },
        logistics: {
          departureDate: "2026-08-10",
          departureMeetingTime: "08:30",
          primaryTransportMode: "bus",
          privateCarMode: "car_share_fixed_dong",
          fuelShareToman: 120_000,
          groupSizeMax: 15,
          meetingPoint: "Tehran",
        },
        participation: {
          minimumAge: 18,
          fitnessLevel: "moderate",
          experienceLevel: "basic",
          sportsInsuranceRequired: true,
        },
        itinerary: {
          outline: "day plan",
          programNotes: "مدت تقریبی پیاده‌روی: 4 ساعت",
        },
        policies: {
          cancellationPolicy: "cancel",
        },
      },
    },
    ...overrides,
  };
}

test("transformTourToDenaliWizardValues reads denaliTourKind and core tabs", () => {
  const form = transformTourToDenaliWizardValues(makeApiTour());
  assert.equal(form.basicInfo?.tourType, "mountain_day");
  assert.equal(form.basicInfo?.title, "abcdefghijklmnop");
  assert.deepEqual(form.programNature?.themeIds, ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"]);
  assert.equal(form.policies?.policiesText, "cancel");
  assert.equal(form.programNature?.difficultyLevel, 5.5);
  assert.equal(form.programNature?.hikingHoursApprox, 4);
  assert.equal(form.transport?.transportMode, "bus");
  assert.equal(form.transport?.allowPersonalCar, true);
  assert.equal(form.transport?.dongAmount, 120_000);
  assert.equal(form.pricingPayment?.requiresPayment, true);
  assert.equal(form.pricingPayment?.basePricePerPerson, 500_000);
  assert.equal(form.participantRequirements?.fitnessLevel, "medium");
});

test("transformTourToDenaliWizardValues infers multi-day mountain", () => {
  const api = makeApiTour();
  const td = api.details!.tripDetails as Record<string, unknown>;
  const overview = { ...(td.overview as object) };
  delete (overview as { denaliTourKind?: string }).denaliTourKind;
  td.overview = overview;
  (td.logistics as Record<string, unknown>).returnDate = "2026-08-12";
  const form = transformTourToDenaliWizardValues(api);
  assert.equal(form.basicInfo?.tourType, "mountain_multi");
  assert.ok(form.basicInfo?.endDateTime);
});

const LEADER_A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const LEADER_B = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22";

test("transformTourToDenaliWizardValues pipes leaderUserIds and localGuideName from overview", () => {
  const form = transformTourToDenaliWizardValues(
    makeApiTour({
      details: {
        tripDetails: {
          overview: {
            denaliTourKind: "mountain_day",
            leaderUserIds: [LEADER_A, LEADER_B],
            localGuideName: "Rashid — local mountain guide",
          },
          logistics: { departureDate: "2026-08-10", departureMeetingTime: "08:30" },
        },
      },
    }),
  );
  assert.deepEqual(form.basicInfo?.leaderUserIds, [LEADER_A, LEADER_B]);
  assert.equal(form.basicInfo?.requiresLocalGuide, true);
  assert.equal(form.basicInfo?.localGuideName, "Rashid — local mountain guide");
});

test("transformTourToDenaliWizardValues maps 5-zone locations from overview and logistics", () => {
  const form = transformTourToDenaliWizardValues(
    makeApiTour({
      details: {
        tripDetails: {
          overview: {
            denaliTourKind: "mountain_day",
            gatheringPoint: { addressText: "Tehran Azadi", latitude: 35.7, longitude: 51.4 },
            startPoint: { addressText: "Rineh trailhead", latitude: 35.9, longitude: 52.1 },
            summitPoint: { addressText: "Damavand summit", latitude: 35.95, longitude: 52.11 },
          },
          logistics: {
            departureDate: "2026-08-10",
            departureMeetingTime: "08:30",
            returnPoint: "Tehran drop-off",
          },
        },
      },
    }),
  );
  assert.equal(form.tripDetails?.logistics?.gatheringPoints?.[0]?.title, "Tehran Azadi");
  assert.equal(form.tripDetails?.logistics?.gatheringPoints?.[0]?.location?.latitude, 35.7);
  assert.equal(form.basicInfo?.startPoint?.addressText, "Rineh trailhead");
  assert.equal(form.basicInfo?.summitPoint?.addressText, "Damavand summit");
  assert.equal(form.basicInfo?.endPoint?.addressText, "Tehran drop-off");
  assert.equal(form.basicInfo?.meetingPoint, "Tehran Azadi");
  assert.equal(form.basicInfo?.startPointLocationText, "Rineh trailhead");
});

test("transformTourToDenaliWizardValues preserves itinerary day location pin on clone", () => {
  const api = makeApiTour();
  const td = api.details!.tripDetails as Record<string, unknown>;
  const overview = { ...(td.overview as object) };
  delete (overview as { denaliTourKind?: string }).denaliTourKind;
  td.overview = overview;
  (td.logistics as Record<string, unknown>).returnDate = "2026-08-12";
  td.itinerary = {
    dayPlans: [
      {
        day: 1,
        title: "Camp 1",
        description: "Hike to camp",
        location: { addressText: "Rineh trailhead", latitude: 35.9, longitude: 52.1 },
      },
    ],
  };
  const form = transformTourToDenaliWizardValues(api);
  const row = form.programNature?.itinerary?.[0];
  assert.equal(row?.locationText, "Rineh trailhead");
  assert.equal(row?.location?.latitude, 35.9);
  assert.equal(row?.location?.longitude, 52.1);
});

test("transformTourToDenaliWizardValues remints itinerary day photo ids on multi-day clone", () => {
  const photoId = "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33";
  const api = makeApiTour();
  const td = api.details!.tripDetails as Record<string, unknown>;
  const overview = { ...(td.overview as object) };
  delete (overview as { denaliTourKind?: string }).denaliTourKind;
  td.overview = overview;
  (td.logistics as Record<string, unknown>).returnDate = "2026-08-12";
  td.itinerary = {
    dayPlans: [
      {
        day: 1,
        title: "Camp 1",
        description: "Hike to camp",
        photos: [
          {
            id: photoId,
            url: "https://example.com/day1.jpg",
            filename: "day1.jpg",
            size: 1024,
            mimeType: "image/jpeg",
            uploadedAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      },
    ],
  };
  const form = transformTourToDenaliWizardValues(api);
  assert.equal(form.basicInfo?.tourType, "mountain_multi");
  const row = form.programNature?.itinerary?.[0];
  assert.equal(row?.photos?.length, 1);
  assert.notEqual(row?.photos?.[0]?.id, photoId);
  assert.equal(row?.photos?.[0]?.url, "https://example.com/day1.jpg");
});

test("transformTourToDenaliWizardValues reads itinerary.days and trip-level photos", () => {
  const api = makeApiTour();
  const td = api.details!.tripDetails as Record<string, unknown>;
  const overview = { ...(td.overview as object) };
  delete (overview as { denaliTourKind?: string }).denaliTourKind;
  td.overview = overview;
  (td.logistics as Record<string, unknown>).returnDate = "2026-08-12";
  td.itinerary = {
    days: [
      {
        day: 2,
        title: "Alpine lake",
        activities: "Trek segment",
        location: { addressText: "Lake camp", latitude: 36.1, longitude: 51.2 },
      },
    ],
  };
  td.photos = [
    {
      id: "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d44",
      url: "https://example.com/gallery.jpg",
      filename: "gallery.jpg",
      size: 2048,
      mimeType: "image/jpeg",
      uploadedAt: "2026-06-02T00:00:00.000Z",
    },
  ];
  const form = transformTourToDenaliWizardValues(api);
  assert.equal(form.programNature?.itinerary?.[0]?.day, 2);
  assert.equal(form.programNature?.itinerary?.[0]?.location?.addressText, "Lake camp");
  assert.equal(form.photosData?.photos?.length, 1);
  const gallerySourceId = "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d44";
  assert.notEqual(form.photosData?.photos?.[0]?.id, gallerySourceId);
  assert.equal(form.photosData?.photos?.[0]?.url, "https://example.com/gallery.jpg");
});

test("transformTourToDenaliWizardValues maps segmentActivities locationName fallback", () => {
  const api = makeApiTour();
  const td = api.details!.tripDetails as Record<string, unknown>;
  const overview = { ...(td.overview as object) };
  delete (overview as { denaliTourKind?: string }).denaliTourKind;
  td.overview = overview;
  (td.logistics as Record<string, unknown>).returnDate = "2026-08-12";
  td.itinerary = {
    segmentActivities: [
      {
        dayNumber: 1,
        title: "Day one",
        segments: [{ locationName: "Base camp ridge", latitude: 35.8, longitude: 52.0 }],
      },
    ],
  };
  const form = transformTourToDenaliWizardValues(api);
  const row = form.programNature?.itinerary?.[0];
  assert.equal(row?.locationText, "Base camp ridge");
  assert.equal(row?.location?.addressText, "Base camp ridge");
});

test("should successfully transform legacy minimal tours with completely empty photosData, dayPlans, and missing map zones", () => {
  const form = transformTourToDenaliWizardValues({
    title: "abcdefghijklmnop",
    description: undefined,
    tourType: "mountain",
    details: {
      tripDetails: {
        overview: {},
        itinerary: { dayPlans: [] },
        logistics: { departureDate: "2026-09-01", departureMeetingTime: "08:00" },
        participation: {},
        policies: {},
      },
    },
  });

  assert.equal(typeof form.basicInfo?.title, "string");
  assert.equal(form.basicInfo?.tourType, "mountain_day");
  assert.equal(form.tripDetails?.logistics?.gatheringPoints?.length ?? 0, 0);
  assert.equal(form.basicInfo?.startPoint, undefined);
  assert.equal(form.basicInfo?.summitPoint, undefined);
  assert.equal(form.programNature?.itinerary, undefined);
  assert.deepEqual(form.photosData, { photos: [] });
  assert.equal(form.participantRequirements?.fitnessLevel, undefined);
});

test("transformTourToDenaliWizardValues forbids difficulty carry for event kinds in mapper output", () => {
  const api = makeApiTour();
  const td = api.details!.tripDetails as Record<string, unknown>;
  td.overview = {
    denaliTourKind: "event_cinema",
    shortIntro: "film",
    difficultyLevel: 8,
  };
  const form = transformTourToDenaliWizardValues(api);
  assert.equal(form.basicInfo?.tourType, "event_cinema");
  assert.equal(form.programNature?.difficultyLevel, undefined);
});

test("transformTourToDenaliWizardValues maps participation gear ids to gearItems", () => {
  const reqId = "11111111-1111-4111-8111-111111111111";
  const optId = "22222222-2222-4222-8222-222222222222";
  const api = makeApiTour();
  const td = api.details!.tripDetails as Record<string, unknown>;
  td.participation = {
    ...(td.participation as Record<string, unknown>),
    gearRequiredIds: [reqId],
    gearOptionalIds: [optId],
  };
  const form = transformTourToDenaliWizardValues(api);
  assert.deepEqual(form.participantRequirements?.gearItems, [
    { id: reqId, isRequired: true },
    { id: optId, isRequired: false },
  ]);
});

test("transformTourToDenaliWizardValues defaults gearItems to empty array when participation has no gear", () => {
  const form = transformTourToDenaliWizardValues(makeApiTour());
  assert.deepEqual(form.participantRequirements?.gearItems, []);
});
