import assert from "node:assert/strict";
import test from "node:test";

import {
  denaliApiTourTypeFromCategory,
  denaliCanonicalBasicsFromTourKind,
  denaliDifficultyTypeFromCategory,
  denaliTourKindFromCanonical,
  deriveDenaliPersistenceView,
} from "./denali-canonical-tour-model";

test("denaliCanonicalBasicsFromTourKind round-trips canonical slugs", () => {
  assert.deepEqual(denaliCanonicalBasicsFromTourKind("mountain_multi"), {
    category: "mountain",
    duration: "multi_day",
  });
  assert.deepEqual(denaliCanonicalBasicsFromTourKind("event_cinema"), {
    category: "event",
    duration: "single_day",
    eventVariant: "cinema",
  });
});

test("denaliTourKindFromCanonical round-trips 8 legacy slugs", () => {
  const cases = [
    { category: "mountain" as const, duration: "single_day" as const, kind: "mountain_day" },
    { category: "mountain" as const, duration: "multi_day" as const, kind: "mountain_multi" },
    { category: "event" as const, duration: "single_day" as const, eventVariant: "cinema" as const, kind: "event_cinema" },
  ];
  for (const c of cases) {
    assert.equal(
      denaliTourKindFromCanonical({
        category: c.category,
        duration: c.duration,
        eventVariant: "eventVariant" in c ? c.eventVariant : undefined,
      }),
      c.kind,
    );
  }
});

test("deriveDenaliPersistenceView", () => {
  const view = deriveDenaliPersistenceView({
    basics: { category: "nature", duration: "multi_day", title: "", destinationId: "", schedule: { startsAt: "" } },
  });
  assert.equal(view.denaliTourKind, "nature_multi");
  assert.equal(view.apiTourType, "nature");
  assert.equal(view.isMultiDay, true);
  assert.equal(view.difficultyType, "physical");
  assert.equal(view.paymentMode, "offline_receipt");
});

test("denaliDifficultyTypeFromCategory", () => {
  assert.equal(denaliDifficultyTypeFromCategory("event"), "none");
  assert.equal(denaliDifficultyTypeFromCategory("desert"), "physical");
});

test("denaliApiTourTypeFromCategory maps event to cultural", () => {
  assert.equal(denaliApiTourTypeFromCategory("event"), "cultural");
});
