import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchIranMountainLandmarks } from "../src/index";

describe("@app-tour/iran-mountain-landmarks", () => {
  it("LM-01 matches Damavand keywords", () => {
    const hits = searchIranMountainLandmarks("دماوند", 2);
    assert.ok(hits.length >= 1);
    assert.match(hits[0]!.displayName, /دماوند/);
  });

  it("LM-02 rejects short queries", () => {
    assert.deepEqual(searchIranMountainLandmarks("د", 6), []);
  });
});
