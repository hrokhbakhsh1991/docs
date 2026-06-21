import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliFlatEditSectionLabel } from "../src/ui/chrome/flat-edit-section-label";

describe("resolveDenaliFlatEditSectionLabel", () => {
  it("prefers template step label when present", () => {
    const label = resolveDenaliFlatEditSectionLabel(
      "denali_basic",
      [{ stepId: "denali_basic", enabled: true, label: "Basics", fields: [] }],
      () => "Fallback"
    );
    assert.equal(label, "Basics");
  });

  it("falls back to denali resolver", () => {
    const label = resolveDenaliFlatEditSectionLabel("denali_basic", [], () => "Fallback");
    assert.equal(label, "Fallback");
  });
});
