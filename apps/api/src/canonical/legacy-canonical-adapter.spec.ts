import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LegacyCanonicalAdapter } from "./legacy-canonical-adapter";

describe("LegacyCanonicalAdapter", () => {
  it("rejects direct legacy writes (no dual-write)", () => {
    const adapter = new LegacyCanonicalAdapter();
    assert.throws(
      () =>
        adapter.writeLegacyTour({
          id: "x",
          tenantId: "t",
          canonical: { schemaVersion: 1, roots: ["basics"], data: {} },
          createdAt: new Date().toISOString(),
        }),
      /DUAL_WRITE_FORBIDDEN/
    );
  });
});
