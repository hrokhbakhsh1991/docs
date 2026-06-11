import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeSpotsRemaining,
  withSpotsRemaining,
} from "../src/catalog/compute-spots-remaining";

const BASE_CARD = Object.freeze({
  id: "00000000-0000-4000-8000-000000000210",
  title: "North Ridge Trek",
  shortDescription: null,
  category: null,
  departureAt: null,
  endAt: null,
  priceAmount: null,
  priceCurrency: "IRR",
  coverImageUrl: null,
  totalCapacity: 12,
});

describe("compute-spots-remaining", () => {
  it("DN-CAT-04 subtracts approved party size from capacity", () => {
    assert.equal(computeSpotsRemaining(12, 4), 8);
  });

  it("DN-CAT-05 never returns negative spots", () => {
    assert.equal(computeSpotsRemaining(12, 20), 0);
  });

  it("DN-CAT-06 null capacity yields null spots", () => {
    assert.equal(computeSpotsRemaining(null, 3), null);
  });

  it("withSpotsRemaining attaches field on card", () => {
    const card = withSpotsRemaining(BASE_CARD, 5);
    assert.equal(card.spotsRemaining, 7);
  });
});
