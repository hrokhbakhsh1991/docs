import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliCatalogPickerDefaultExpanded } from "../src/ui/logic/denali-catalog-picker-logic";

describe("denali-catalog-picker-logic", () => {
  it("keeps catalog pickers compact until the operator expands them", () => {
    assert.equal(resolveDenaliCatalogPickerDefaultExpanded(), false);
  });
});
