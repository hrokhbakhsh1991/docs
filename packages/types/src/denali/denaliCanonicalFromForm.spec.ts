import assert from "node:assert/strict";
import test from "node:test";

import { denaliCanonicalFromForm } from "./denaliCanonicalFromForm";

test("denaliCanonicalFromForm maps mountain_day MVP fields", () => {
  const canonical = denaliCanonicalFromForm({
    basicInfo: {
      title: "Day hike",
      tourType: "mountain_day",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-06-01T08:00:00.000Z",
      capacityMax: 20,
    },
    programNature: {
      themeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
      shortDescription: "Short",
    },
    transport: { transportMode: "organizer_vehicle", transportNotes: "Bring water" },
    pricingPayment: { requiresPayment: true, basePricePerPerson: 100 },
    participantRequirements: { minimumAge: 18 },
    policies: { cancellationPolicy: "Be on time." },
  });

  assert.equal(canonical.category, "mountain");
  assert.equal(canonical.duration, "single");
  assert.deepEqual(canonical.program.themeIds, ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"]);
  assert.equal(canonical.policies.policiesText, "Be on time.");
  assert.equal(canonical.transport.mode, "organizer_vehicle");
  assert.equal(canonical.transport.transportNotes, "Bring water");
  assert.equal("difficultyLevel" in canonical, false);
});

test("denaliCanonicalFromForm maps event_cinema without outdoor legacy fields", () => {
  const canonical = denaliCanonicalFromForm({
    basicInfo: {
      title: "Cinema night",
      tourType: "event_cinema",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-06-01T20:00:00.000Z",
      capacityMax: 50,
    },
    programNature: {
      mainTourThemeId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      shortDescription: "Film",
      difficultyLevel: 1,
      hikingHoursApprox: 3,
    },
    transport: { transportMode: "none" },
    pricingPayment: { requiresPayment: false },
    participantRequirements: {},
    policies: {},
  });

  assert.equal(canonical.category, "event");
  assert.equal(canonical.duration, "single");
  assert.equal(canonical.pricing.basePricePerPerson, undefined);
});

test("denaliCanonicalFromForm maps tripDetails.overview.customServiceLabels", () => {
  const canonical = denaliCanonicalFromForm({
    basicInfo: {
      title: "Urban tour",
      tourType: "event_reading",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-06-01T08:00:00.000Z",
      capacityMax: 10,
    },
    programNature: { shortDescription: "Short" },
    transport: { transportMode: "none" },
    pricingPayment: { requiresPayment: false },
    participantRequirements: {},
    policies: {},
    tripDetails: {
      overview: { customServiceLabels: ["  Shuttle  ", "", "Guide"] },
    },
  });

  assert.deepEqual(canonical.customServiceLabels, ["Shuttle", "Guide"]);
});

test("denaliCanonicalFromForm throws when tourType is missing", () => {
  assert.throws(
    () =>
      denaliCanonicalFromForm({
        basicInfo: {
          title: "Day hike",
          destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          startDateTime: "2026-06-01T08:00:00.000Z",
        },
        programNature: { shortDescription: "Short" },
        transport: { transportMode: "none" },
        pricingPayment: { requiresPayment: false },
        participantRequirements: {},
        policies: {},
      }),
    /basicInfo\.tourType is required/,
  );
});

const GALLERY_PHOTO_ID = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

test("denaliCanonicalFromForm maps photosData.photos to canonical photos", () => {
  const canonical = denaliCanonicalFromForm({
    basicInfo: {
      title: "Gallery tour",
      tourType: "mountain_day",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-06-01T08:00:00.000Z",
      capacityMax: 20,
    },
    programNature: { shortDescription: "Short" },
    transport: { transportMode: "none" },
    pricingPayment: { requiresPayment: false },
    participantRequirements: {},
    policies: {},
    photosData: {
      photos: [
        {
          id: GALLERY_PHOTO_ID,
          url: `https://cdn.example.test/${GALLERY_PHOTO_ID}/cover.jpg`,
          filename: "cover.jpg",
          size: 2048,
          mimeType: "image/jpeg",
          uploadedAt: "2026-05-01T12:00:00.000Z",
        },
      ],
    },
  });

  assert.equal(canonical.photos?.length, 1);
  assert.equal(canonical.photos?.[0]?.filename, "cover.jpg");
});

test("denaliCanonicalFromForm maps programNature.itinerary into program.itinerary", () => {
  const canonical = denaliCanonicalFromForm({
    basicInfo: {
      title: "Multi-day",
      tourType: "mountain_multi",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-06-01T08:00:00.000Z",
      capacityMax: 12,
    },
    programNature: {
      shortDescription: "Short",
      itinerary: [{ day: 1, activities: "Summit push", locationText: "Camp A" }],
    },
    transport: { transportMode: "none" },
    pricingPayment: { requiresPayment: false },
    participantRequirements: {},
    policies: {},
  });

  assert.equal(canonical.program.itinerary?.length, 1);
  assert.equal(canonical.program.itinerary?.[0]?.activities, "Summit push");
  assert.equal(canonical.program.itinerary?.[0]?.locationText, "Camp A");
});

test("denaliCanonicalFromForm carryForward retains itinerary when form slice was cleared", () => {
  const canonical = denaliCanonicalFromForm(
    {
      basicInfo: {
        title: "Day hike",
        tourType: "mountain_day",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2026-06-01T08:00:00.000Z",
        capacityMax: 20,
      },
      programNature: { shortDescription: "Short" },
      transport: { transportMode: "none" },
      pricingPayment: { requiresPayment: false },
      participantRequirements: {},
      policies: {},
      photosData: {
        photos: [
          {
            id: GALLERY_PHOTO_ID,
            url: `https://cdn.example.test/${GALLERY_PHOTO_ID}/cover.jpg`,
            filename: "cover.jpg",
            size: 2048,
            mimeType: "image/jpeg",
            uploadedAt: "2026-05-01T12:00:00.000Z",
          },
        ],
      },
    },
    {
      programItinerary: [{ day: 1, activities: "Carried forward day" }],
    },
  );

  assert.equal(canonical.program.itinerary?.[0]?.activities, "Carried forward day");
  assert.equal(canonical.photos?.length, 1);
});

test("denaliCanonicalFromForm throws when tourType is invalid", () => {
  assert.throws(
    () =>
      denaliCanonicalFromForm({
        basicInfo: {
          title: "Day hike",
          tourType: "not_a_real_kind" as "mountain_day",
          destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          startDateTime: "2026-06-01T08:00:00.000Z",
        },
        programNature: { shortDescription: "Short" },
        transport: { transportMode: "none" },
        pricingPayment: { requiresPayment: false },
        participantRequirements: {},
        policies: {},
      }),
    /basicInfo\.tourType is required/,
  );
});
