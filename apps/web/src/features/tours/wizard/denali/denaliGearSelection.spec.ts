import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeGearItems,
  removeGearItem,
  splitGearByRequired,
  upsertGearItem,
} from "./denaliGearSelection";

describe("denaliGearSelection", () => {
  it("upsert adds optional row by default", () => {
    const next = upsertGearItem(undefined, "boots-id", {});
    assert.deepEqual(next, [{ id: "boots-id", isRequired: false }]);
  });

  it("upsert toggles isRequired on existing row", () => {
    const list = [{ id: "a", isRequired: false }];
    const next = upsertGearItem(list, "a", { isRequired: true });
    assert.deepEqual(next, [{ id: "a", isRequired: true }]);
  });

  it("remove drops row", () => {
    const list = [
      { id: "a", isRequired: true },
      { id: "b", isRequired: false },
    ];
    assert.deepEqual(removeGearItem(list, "a"), [{ id: "b", isRequired: false }]);
  });

  it("splitGearByRequired partitions ids", () => {
    const { required, optional } = splitGearByRequired([
      { id: "r", isRequired: true },
      { id: "o", isRequired: false },
    ]);
    assert.equal(required.length, 1);
    assert.equal(optional.length, 1);
    assert.equal(required[0]?.id, "r");
    assert.equal(optional[0]?.id, "o");
  });

  it("normalizeGearItems omits empty arrays", () => {
    assert.equal(normalizeGearItems([]), undefined);
    assert.deepEqual(normalizeGearItems([{ id: "x", isRequired: false }]), [
      { id: "x", isRequired: false },
    ]);
  });
});
