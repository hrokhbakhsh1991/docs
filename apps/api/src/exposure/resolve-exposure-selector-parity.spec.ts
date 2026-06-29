import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveExposureSelectorParity } from "./resolve-exposure-selector-parity";

describe("resolveExposureSelectorParity", () => {
  it("reports matching selectors after sorting and deduplication", () => {
    assert.deepEqual(
      resolveExposureSelectorParity({
        legacyEligibleFieldIds: ["details.summary", "basics.title", "basics.title"],
        engineSelectedFieldIds: ["basics.title", "details.summary"],
      }),
      {
        matches: true,
        legacyOnlyFieldIds: [],
        engineOnlyFieldIds: [],
        legacyFieldCount: 2,
        engineFieldCount: 2,
        mismatchCount: 0,
      },
    );
  });

  it("reports fields that only one selector would deliver", () => {
    assert.deepEqual(
      resolveExposureSelectorParity({
        legacyEligibleFieldIds: ["legacy.title", "shared.title"],
        engineSelectedFieldIds: ["engine.title", "shared.title"],
      }),
      {
        matches: false,
        legacyOnlyFieldIds: ["legacy.title"],
        engineOnlyFieldIds: ["engine.title"],
        legacyFieldCount: 2,
        engineFieldCount: 2,
        mismatchCount: 2,
      },
    );
  });

  it("ignores blank field ids before comparing", () => {
    const report = resolveExposureSelectorParity({
      legacyEligibleFieldIds: ["", "  ", "title"],
      engineSelectedFieldIds: ["title"],
    });

    assert.equal(report.matches, true);
    assert.equal(report.legacyFieldCount, 1);
  });
});
