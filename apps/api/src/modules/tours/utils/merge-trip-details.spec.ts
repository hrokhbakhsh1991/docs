import test from "node:test";
import assert from "node:assert/strict";

import { mergeTourTripDetails } from "./merge-trip-details";

test("mergeTourTripDetails preserves sibling keys when patching one branch", () => {
  const existing = {
    overview: { mainDestination: "X", shortIntro: "old" },
    policies: { cancellationPolicy: "48h" }
  };
  const next = mergeTourTripDetails(existing, {
    overview: { shortIntro: "new" }
  });
  assert.equal(next.overview?.mainDestination, "X");
  assert.equal(next.overview?.shortIntro, "new");
  assert.equal(next.policies?.cancellationPolicy, "48h");
});

test("mergeTourTripDetails replaces arrays when provided", () => {
  const existing = {
    itinerary: { highlights: ["a", "b"], outline: "keep" }
  };
  const next = mergeTourTripDetails(existing, {
    itinerary: { highlights: ["c"] }
  });
  assert.deepEqual(next.itinerary?.highlights, ["c"]);
  assert.equal(next.itinerary?.outline, "keep");
});
