import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  denaliCanonicalBasicsFromTourKind,
  denaliTourKindFromCanonical,
} from "../src/types/legacy/denali-canonical-basics";
import { DENALI_TOUR_KIND_VALUES, isDenaliEventTourKind } from "../src/types/legacy/denali-tour-kind";

describe("denali-event-multi-day-slug.spec.ts", () => {
  it("DN-EVENT-01 encodes event multi-day reading and cinema slugs", () => {
    assert.equal(
      denaliTourKindFromCanonical({
        category: "event",
        duration: "multi_day",
        eventVariant: "reading",
      }),
      "event_reading_multi"
    );
    assert.equal(
      denaliTourKindFromCanonical({
        category: "event",
        duration: "multi_day",
        eventVariant: "cinema",
      }),
      "event_cinema_multi"
    );
  });

  it("DN-EVENT-02 decodes event multi-day slugs back to basics", () => {
    assert.deepEqual(denaliCanonicalBasicsFromTourKind("event_reading_multi"), {
      category: "event",
      duration: "multi_day",
      eventVariant: "reading",
    });
    assert.deepEqual(denaliCanonicalBasicsFromTourKind("event_cinema_multi"), {
      category: "event",
      duration: "multi_day",
      eventVariant: "cinema",
    });
  });

  it("DN-EVENT-03 registers 10 tour kind slugs including event multi-day", () => {
    assert.equal(DENALI_TOUR_KIND_VALUES.length, 10);
    assert.equal(isDenaliEventTourKind("event_reading_multi"), true);
    assert.equal(isDenaliEventTourKind("event_cinema_multi"), true);
  });
});
