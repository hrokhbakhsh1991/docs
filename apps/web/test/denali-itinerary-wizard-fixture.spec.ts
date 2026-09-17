import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_DEV_DEFAULT_DESTINATION_LABEL,
  OPERATOR_SMOKE_DESTINATION_LABEL,
  OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M,
  resolveLockedPeakHeightForDestination,
} from "./fixtures/denali-itinerary-wizard-fixture";

describe("resolveLockedPeakHeightForDestination", () => {
  it("maps operator smoke and denali club destinations", () => {
    assert.equal(
      resolveLockedPeakHeightForDestination(OPERATOR_SMOKE_DESTINATION_LABEL),
      OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M,
    );
    assert.equal(resolveLockedPeakHeightForDestination(DENALI_DEV_DEFAULT_DESTINATION_LABEL), 5610);
    assert.equal(resolveLockedPeakHeightForDestination("توچال"), 3962);
  });

  it("throws for unknown labels", () => {
    assert.throws(
      () => resolveLockedPeakHeightForDestination("Unknown Peak"),
      /Unknown destination/,
    );
  });
});
