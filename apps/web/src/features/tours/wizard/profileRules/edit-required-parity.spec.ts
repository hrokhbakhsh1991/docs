import assert from "node:assert/strict";
import test from "node:test";

import { getEditRequiredTripDetailsPathsForProfile } from "@repo/types";

/**
 * API publish gate reads the same edit-required list as the descriptor (mountain_outdoor).
 */
test("edit-required paths: @repo/types is authoritative for mountain_outdoor", () => {
  const paths = getEditRequiredTripDetailsPathsForProfile("mountain_outdoor");
  assert.ok(paths.includes("participation.minimumAge"));
  assert.ok(paths.includes("logistics.departureDate"));
  assert.equal(paths.length, 5);
});
