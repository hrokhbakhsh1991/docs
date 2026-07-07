import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveShadowExposureParity } from "./shadow-exposure-parity";

describe("resolveShadowExposureParity", () => {
  it("aggregates delivery and rendered parity", () => {
    const parity = resolveShadowExposureParity({
      deliveryParity: { matches: true, mismatches: [] },
      renderedParity: { matches: true, mismatches: [] },
    });

    assert.equal(parity.matches, true);
    assert.deepEqual(parity.mismatches, []);
  });

  it("includes intent parity mismatches in aggregate output", () => {
    const parity = resolveShadowExposureParity({
      deliveryParity: { matches: true, mismatches: [] },
      renderedParity: { matches: true, mismatches: [] },
      intentParity: { matches: false, mismatches: ["selected_field_ids"] },
    });

    assert.equal(parity.matches, false);
    assert.deepEqual(parity.mismatches, ["selected_field_ids"]);
  });
});
