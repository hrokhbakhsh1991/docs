import assert from "node:assert/strict";
import test from "node:test";

import { buildTourDetailViewForAccess } from "./tour-detail-redaction";

const TOUR_ID = "11111111-1111-4111-8111-111111111111";

function sampleTour(): Record<string, unknown> {
  return {
    id: TOUR_ID,
    title: "Alpine trek",
    chatLink: "https://t.me/secret",
    communicationLink: "https://t.me/secret",
    formProfileSnapshot: "denali_pilot",
    details: {
      tripDetails: {
        overview: {
          shortIntro: "Public summary",
          startPoint: { addressText: "Base", latitude: 35.7, longitude: 51.4 },
        },
        itinerary: {
          outline: "Day hike",
          segmentActivities: [{ dayNumber: 1, title: "Ascent", description: "Steep" }],
          dayPlans: [{ day: 1, title: "Day 1" }],
        },
        logistics: {
          departureDate: "2030-06-01",
          departureMeetingTime: "06:00",
          meetingPoint: "Exact pin",
          gatheringPoints: [
            {
              title: "Station A",
              location: { addressText: "A", latitude: 35.1, longitude: 51.1 },
            },
          ],
        },
        participation: { minimumAge: 18, gearRequiredIds: ["gear-1"] },
        policies: { cancellationPolicy: "Strict" },
      },
    },
  };
}

test("GUEST strips itinerary segments, GPS, logistics points, policies, chat", () => {
  const view = buildTourDetailViewForAccess(sampleTour(), "GUEST", {
    gpsUnlocked: false,
    gpsUnlockAt: null,
  });
  const td = (view.details as Record<string, unknown>).tripDetails as Record<string, unknown>;
  const itinerary = td.itinerary as Record<string, unknown>;
  assert.equal(itinerary.outline, "Day hike");
  assert.equal(itinerary.segmentActivities, undefined);
  assert.equal(itinerary.dayPlans, undefined);
  assert.equal((td.overview as Record<string, unknown>).startPoint, undefined);
  const participation = td.participation as Record<string, unknown>;
  assert.ok(Array.isArray(participation.gearRequiredIds));
  assert.equal(participation.minimumAge, undefined);
  assert.equal(td.policies, undefined);
  assert.equal((td.logistics as Record<string, unknown>).meetingPoint, undefined);
  assert.equal(view.chatLink, undefined);
  assert.equal(view.formProfileSnapshot, undefined);
});

test("PURCHASED_USER pre-unlock keeps itinerary but masks coordinates", () => {
  const view = buildTourDetailViewForAccess(sampleTour(), "PURCHASED_USER", {
    gpsUnlocked: false,
    gpsUnlockAt: "2030-05-30T06:00:00.000Z",
  });
  const td = (view.details as Record<string, unknown>).tripDetails as Record<string, unknown>;
  const itinerary = td.itinerary as Record<string, unknown>;
  assert.ok(Array.isArray(itinerary.segmentActivities));
  const start = (td.overview as Record<string, unknown>).startPoint as Record<string, unknown>;
  assert.equal(start.addressText, "Base");
  assert.equal(start.latitude, null);
  assert.equal(start.longitude, null);
  const gathering = (td.logistics as Record<string, unknown>).gatheringPoints as Record<
    string,
    unknown
  >[];
  const loc = gathering[0]!.location as Record<string, unknown>;
  assert.equal(loc.latitude, null);
  assert.equal(view.chatLink, undefined);
});

test("PURCHASED_USER unlocked keeps full coordinates", () => {
  const view = buildTourDetailViewForAccess(sampleTour(), "PURCHASED_USER", {
    gpsUnlocked: true,
    gpsUnlockAt: null,
  });
  const td = (view.details as Record<string, unknown>).tripDetails as Record<string, unknown>;
  const start = (td.overview as Record<string, unknown>).startPoint as Record<string, unknown>;
  assert.equal(start.latitude, 35.7);
});

test("OPERATIONAL keeps full itinerary and GPS but strips chat", () => {
  const view = buildTourDetailViewForAccess(sampleTour(), "OPERATIONAL", {
    gpsUnlocked: true,
    gpsUnlockAt: null,
  });
  assert.equal(view.chatLink, undefined);
  const td = (view.details as Record<string, unknown>).tripDetails as Record<string, unknown>;
  const start = (td.overview as Record<string, unknown>).startPoint as Record<string, unknown>;
  assert.equal(start.latitude, 35.7);
  assert.ok(Array.isArray((td.itinerary as Record<string, unknown>).segmentActivities));
});

test("OWNER retains chat link", () => {
  const view = buildTourDetailViewForAccess(sampleTour(), "OWNER", {
    gpsUnlocked: true,
    gpsUnlockAt: null,
  });
  assert.equal(view.chatLink, "https://t.me/secret");
});
