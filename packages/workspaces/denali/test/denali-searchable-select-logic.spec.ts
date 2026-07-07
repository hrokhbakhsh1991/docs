/**
 * Denali searchable select — combobox for long catalog lists.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD,
  filterSelectOptionsByQuery,
  resolveSelectOptionLabel,
  shouldUseDenaliSearchableSelect,
} from "../src/ui/logic/denali-searchable-select-logic";

describe("denali-searchable-select-logic.spec.ts", () => {
  it("WEB-DENALI-DEST-01 switches to searchable above threshold", () => {
    assert.equal(shouldUseDenaliSearchableSelect(8), false);
    assert.equal(shouldUseDenaliSearchableSelect(9), true);
    assert.equal(DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD, 8);
  });

  it("WEB-DENALI-DEST-02 filters options by label substring", () => {
    const options = [
      { value: "1", label: "Damavand (Alborz)" },
      { value: "2", label: "Zagros Ridge" },
    ];
    assert.deepEqual(filterSelectOptionsByQuery(options, "dam"), [
      { value: "1", label: "Damavand (Alborz)" },
    ]);
    assert.deepEqual(filterSelectOptionsByQuery(options, ""), options);
  });

  it("WEB-DENALI-DEST-03 resolves selected label", () => {
    const options = [{ value: "dest-1", label: "Damavand" }];
    assert.equal(resolveSelectOptionLabel(options, "dest-1"), "Damavand");
    assert.equal(resolveSelectOptionLabel(options, ""), undefined);
  });
});
