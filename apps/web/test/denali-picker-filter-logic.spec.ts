import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterPickerItemsByQuery } from "@app-tour/workspace-denali/host/ui/logic/denali-picker-filter-logic";

describe("denali-picker-filter-logic.spec.ts", () => {
  it("WEB-DENALI-PICKER-01 filters items by case-insensitive substring", () => {
    const items = [{ name: "Sleeping bag" }, { name: "Headlamp" }];
    assert.deepEqual(
      filterPickerItemsByQuery(items, "sleep", (item) => item.name),
      [{ name: "Sleeping bag" }]
    );
    assert.equal(filterPickerItemsByQuery(items, "  ", (item) => item.name).length, 2);
  });
});
