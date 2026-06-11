/**
 * Phase 11.4 — wizard field path DOM contract (WEB-P11-4-01)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wizardFieldPathAttributes, WIZARD_FIELD_PATH_ATTR } from "@app-tour/wizard-navigation";

describe("wizard-field-path-attributes.spec.ts — Phase 11.4", () => {
  it("WEB-P11-4-01 wizardFieldPathAttributes exposes canonical path", () => {
    const attrs = wizardFieldPathAttributes("basicInfo.title", "basics.title");
    assert.equal(attrs[WIZARD_FIELD_PATH_ATTR], "basicInfo.title");
    assert.equal(attrs["data-field-id"], "basics.title");
  });
});
