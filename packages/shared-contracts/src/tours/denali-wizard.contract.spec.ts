import assert from "node:assert/strict";
import test from "node:test";

import { DENALI_ROOTS } from "./denali-wizard.contract";

test("DENALI_ROOTS has seven canonical wizard roots including photosData", () => {
  assert.deepEqual([...DENALI_ROOTS], [
    "basicInfo",
    "programNature",
    "transport",
    "pricingPayment",
    "participantRequirements",
    "policies",
    "photosData",
  ]);
});
