import assert from "node:assert/strict";
import test from "node:test";

import {
  denaliFormAmountToCanonical,
  denaliFormCapacityMaxToCanonical,
  isDenaliPositiveInt,
} from "./denaliNumericFields";
import { denaliCanonicalFromForm } from "./denaliCanonicalFromForm";

test("denaliFormCapacityMaxToCanonical does not coerce undefined to zero", () => {
  assert.equal(denaliFormCapacityMaxToCanonical(undefined), undefined);
  assert.equal(denaliFormCapacityMaxToCanonical(null), undefined);
});

test("denaliFormCapacityMaxToCanonical preserves zero for validation", () => {
  assert.equal(denaliFormCapacityMaxToCanonical(0), 0);
});

test("denaliCanonicalFromForm leaves capacityMax unset when form omits it", () => {
  const canonical = denaliCanonicalFromForm({
    basicInfo: {
      title: "Test tour title here",
      tourType: "mountain_day",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-06-01T08:00:00.000Z",
    },
    programNature: {
      mainTourThemeId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      shortDescription: "Short",
    },
    transport: { transportMode: "organizer_vehicle" },
    pricingPayment: { requiresPayment: false },
    participantRequirements: {},
    policies: {},
  });

  assert.equal(canonical.capacityMax, undefined);
});

test("isDenaliPositiveInt rejects zero and null", () => {
  assert.equal(isDenaliPositiveInt(0), false);
  assert.equal(isDenaliPositiveInt(null), false);
  assert.equal(isDenaliPositiveInt(3), true);
});

test("denaliFormAmountToCanonical preserves zero dong for downstream rejection", () => {
  assert.equal(denaliFormAmountToCanonical(0), 0);
  assert.equal(denaliFormAmountToCanonical(undefined), undefined);
});
