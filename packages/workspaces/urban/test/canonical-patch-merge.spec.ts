import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeUrbanCanonicalPatchData } from "../src/tours/canonical-patch-merge";

describe("mergeUrbanCanonicalPatchData (P4-T06)", () => {
  it("deep-merges object roots", () => {
    const merged = mergeUrbanCanonicalPatchData(
      { tour: { title: "A", status: "draft" }, meta: { v: 1 } },
      { tour: { status: "published" } }
    );
    assert.deepEqual(merged, {
      tour: { title: "A", status: "published" },
      meta: { v: 1 },
    });
  });

  it("returns existing when patch is undefined", () => {
    const existing = { tour: { title: "A" } };
    assert.equal(mergeUrbanCanonicalPatchData(existing, undefined), existing);
  });
});
