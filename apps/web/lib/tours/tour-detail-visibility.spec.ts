import assert from "node:assert/strict";
import test from "node:test";

import {
  isTourDetailGearAggregationIncomplete,
  shouldShowTourDetailEquipmentCard,
} from "./tour-detail-visibility";

test("shouldShowTourDetailEquipmentCard when gear ids exist without resolved names", () => {
  assert.equal(
    shouldShowTourDetailEquipmentCard({
      gearLists: { required: [], optional: [] },
      gearRequiredIds: ["g1"],
    }),
    true,
  );
});

test("shouldShowTourDetailEquipmentCard when resolved gear exists", () => {
  assert.equal(
    shouldShowTourDetailEquipmentCard({
      gearLists: { required: [{ id: "g1", name: "Boots" }], optional: [] },
    }),
    true,
  );
});

test("shouldShowTourDetailEquipmentCard hides when no gear", () => {
  assert.equal(
    shouldShowTourDetailEquipmentCard({
      gearLists: { required: [], optional: [] },
    }),
    false,
  );
});

test("isTourDetailGearAggregationIncomplete when ids exist but resolved empty", () => {
  assert.equal(
    isTourDetailGearAggregationIncomplete({
      participationPresent: true,
      gearLists: { required: [], optional: [] },
      gearRequiredIds: ["g1"],
    }),
    true,
  );
});
