import assert from "node:assert/strict";
import test from "node:test";

import { searchIranMountainLandmarks } from "./iran-mountain-landmarks";

test("searchIranMountainLandmarks matches دماوند and returns static coordinates", () => {
  const rows = searchIranMountainLandmarks("دماوند بارگاه");
  assert.ok(rows.length >= 1);
  assert.match(rows[0]?.displayName ?? "", /دماوند/);
  assert.equal(rows[0]?.latitude, 35.9519);
});

test("searchIranMountainLandmarks matches Tochal latin keyword", () => {
  const rows = searchIranMountainLandmarks("tochal");
  assert.ok(rows.some((r) => r.displayName.includes("توچال")));
});

test("searchIranMountainLandmarks returns empty for short query", () => {
  assert.deepEqual(searchIranMountainLandmarks("د"), []);
});
