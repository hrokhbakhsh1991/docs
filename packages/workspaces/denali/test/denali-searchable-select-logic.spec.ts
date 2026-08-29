/**
 * Denali searchable select — combobox for long catalog lists.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DENALI_SEARCHABLE_SELECT_MAX_VISIBLE,
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

  it("WEB-DENALI-DEST-04 requireQuery hides browse list until search", () => {
    const options = [
      { value: "1", label: "Damavand" },
      { value: "2", label: "Zagros" },
    ];
    assert.deepEqual(
      filterSelectOptionsByQuery(options, "", { requireQuery: true }),
      []
    );
    assert.deepEqual(filterSelectOptionsByQuery(options, "dam", { requireQuery: true }), [
      { value: "1", label: "Damavand" },
    ]);
  });

  it("WEB-DENALI-DEST-05 pins selected value when requireQuery and empty search", () => {
    const options = [
      { value: "1", label: "Damavand" },
      { value: "2", label: "Zagros" },
    ];
    assert.deepEqual(
      filterSelectOptionsByQuery(options, "", {
        requireQuery: true,
        pinnedValue: "2",
      }),
      [{ value: "2", label: "Zagros" }]
    );
  });

  it("WEB-DENALI-DEST-06 caps rendered options for long catalogs", () => {
    const options = Array.from({ length: 120 }, (_, index) => ({
      value: `dest-${index}`,
      label: `Destination ${index}`,
    }));
    const capped = filterSelectOptionsByQuery(options, "", { maxVisible: 50 });
    assert.equal(capped.length, 50);
    assert.equal(DEFAULT_DENALI_SEARCHABLE_SELECT_MAX_VISIBLE, 50);
  });

  it("WEB-DENALI-DEST-07 keeps pinned selected value inside cap slice", () => {
    const options = Array.from({ length: 120 }, (_, index) => ({
      value: `dest-${index}`,
      label: `Destination ${index}`,
    }));
    const capped = filterSelectOptionsByQuery(options, "", {
      maxVisible: 50,
      pinnedValue: "dest-99",
    });
    assert.equal(capped.length, 50);
    assert.equal(capped[0]?.value, "dest-99");
  });
});
