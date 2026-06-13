import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE,
  OPERATOR_SMOKE_SEED_TOUR_ID,
  buildOperatorSmokePublishedTourCanonical,
} from "../src/fixtures/operator-smoke-published-tour.fixture";

describe("operator-smoke-published-tour.fixture.ts", () => {
  it("API-SMOKE-TPL-01 published tour canonical includes multi-day itinerary", () => {
    const canonical = buildOperatorSmokePublishedTourCanonical();
    assert.equal(canonical.data.title, OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE);
    const program = canonical.data.program as {
      itinerary?: Array<{ title?: string; segments?: Array<{ title?: string }> }>;
    };
    assert.equal(program.itinerary?.length, 2);
    assert.equal(program.itinerary?.[0]?.title, "Summit push");
    assert.equal(program.itinerary?.[0]?.segments?.[0]?.title, "Ridge ascent");
    assert.equal(OPERATOR_SMOKE_SEED_TOUR_ID, "00000000-0000-4000-8000-000000000210");
  });
});
