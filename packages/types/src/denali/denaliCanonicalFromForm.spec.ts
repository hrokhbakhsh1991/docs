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
      mainTourThemeId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
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
