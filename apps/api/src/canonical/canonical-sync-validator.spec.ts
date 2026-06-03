import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCanonicalLegacySync } from "./canonical-sync-validator";

describe("validateCanonicalLegacySync", () => {
  it("passes when legacy mirror is empty (Phase 3.4 single write path)", () => {
    const result = validateCanonicalLegacySync({
      canonicalRecords: [
        {
          id: "t1",
          tenantId: "tenant-a",
          canonical: { schemaVersion: 1, roots: ["basics"], data: { basics: { title: "x" } } },
          createdAt: new Date().toISOString(),
        },
      ],
      legacyRecords: [],
    });
    assert.equal(result.ok, true);
  });

  it("fails when legacy has orphan rows (dual-write drift)", () => {
    const result = validateCanonicalLegacySync({
      canonicalRecords: [],
      legacyRecords: [
        {
          id: "orphan",
          tenantId: "tenant-a",
          canonical: { schemaVersion: 1, roots: ["basics"], data: {} },
          createdAt: new Date().toISOString(),
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.startsWith("legacy_orphan")));
  });
});
