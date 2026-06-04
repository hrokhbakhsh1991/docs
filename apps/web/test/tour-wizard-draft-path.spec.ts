import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import {
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../src/tours/tour-wizard-draft-path";

describe("tour wizard draft canonical paths (P0-04)", () => {
  it("reads and writes via render-plan canonical paths", () => {
    const draft = emptyTourWizardDraft();
    assert.equal(getCanonicalStringValue(draft, "basics.title"), "");
    const next = setCanonicalStringValue(draft, "basics.title", "My tour");
    assert.equal(getCanonicalStringValue(next, "basics.title"), "My tour");
    assert.equal(getCanonicalStringValue(draft, "basics.title"), "");
  });

  it("returns empty string for unknown paths", () => {
    const draft = emptyTourWizardDraft();
    assert.equal(getCanonicalStringValue(draft, "unknown.path"), "");
  });
});
