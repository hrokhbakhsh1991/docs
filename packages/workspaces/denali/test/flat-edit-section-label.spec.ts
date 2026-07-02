import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliFlatEditSectionLabel } from "../src/ui/chrome/flat-edit-section-label";

describe("resolveDenaliFlatEditSectionLabel", () => {
  it("prefers localized step label over template admin copy", () => {
    const label = resolveDenaliFlatEditSectionLabel(
      "denali_basic",
      [{ stepId: "denali_basic", enabled: true, label: "Basics", fields: [] }],
      () => "اطلاعات پایه"
    );
    assert.equal(label, "اطلاعات پایه");
  });

  it("falls back to template label when localized label is empty", () => {
    const label = resolveDenaliFlatEditSectionLabel(
      "denali_basic",
      [{ stepId: "denali_basic", enabled: true, label: "Basics", fields: [] }],
      () => ""
    );
    assert.equal(label, "Basics");
  });

  it("falls back to step id when neither localized nor template label exists", () => {
    const label = resolveDenaliFlatEditSectionLabel("denali_basic", [], () => "");
    assert.equal(label, "denali_basic");
  });
});
