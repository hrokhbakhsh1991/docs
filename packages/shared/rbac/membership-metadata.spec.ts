import assert from "node:assert/strict";
import test from "node:test";

import { parseMembershipMetadata } from "./membership-metadata";

test("parseMembershipMetadata reads allowedRegionIds and capabilities", () => {
  assert.deepEqual(
    parseMembershipMetadata({
      allowedRegionIds: ["  r1  ", "r2"],
      capabilities: ["tour.regional.manage"],
    }),
    {
      allowedRegionIds: ["r1", "r2"],
      capabilities: ["tour.regional.manage"],
    },
  );
});
