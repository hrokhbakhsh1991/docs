import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeShallowCanonicalPatchData } from "../src/canonical/canonical-patch-merge";

describe("canonical-patch-merge (CW5-08)", () => {
  it("merges sibling roots on fragment PATCH", () => {
    const existing = {
      basics: { title: "Seed" },
      details: { summary: "ok" },
      pricing: { paymentMode: "gateway" },
    };
    const merged = mergeShallowCanonicalPatchData(existing, {
      basics: { title: "Updated" },
    });
    assert.equal((merged.basics as { title: string }).title, "Updated");
    assert.deepEqual(merged.details, { summary: "ok" });
    assert.deepEqual(merged.pricing, { paymentMode: "gateway" });
  });
});
