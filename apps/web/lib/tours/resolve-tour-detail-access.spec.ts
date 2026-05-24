import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_DETAIL_PURCHASED_REGISTRATION_STATUSES } from "@repo/types";

test("purchased registration statuses are Accepted and AcceptedPaid only", () => {
  assert.deepEqual([...TOUR_DETAIL_PURCHASED_REGISTRATION_STATUSES], [
    "Accepted",
    "AcceptedPaid",
  ]);
});
