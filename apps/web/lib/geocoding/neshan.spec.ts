import assert from "node:assert/strict";
import test from "node:test";

import { parseNeshanRows } from "./neshan";

test("parseNeshanRows maps title and location.y/x to lat/lng", () => {
  const rows = parseNeshanRows({
    items: [
      {
        title: "میدان آزادی",
        address: "تهران",
        location: { x: 51.352, y: 35.7 },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.displayName, "میدان آزادی");
  assert.equal(rows[0]?.latitude, 35.7);
  assert.equal(rows[0]?.longitude, 51.352);
});
