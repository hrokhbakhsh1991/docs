import assert from "node:assert/strict";
import test from "node:test";

import {
  DENALI_CATEGORY_ENUM,
  migrateLegacyEquipmentCategory,
  normalizeCompatibleCategories,
} from "./denaliCategoryEnum";

test("DENALI_CATEGORY_ENUM lists canonical tour categories", () => {
  assert.deepEqual([...DENALI_CATEGORY_ENUM], ["mountain", "nature", "desert", "event"]);
});

test("normalizeCompatibleCategories filters unknown values", () => {
  assert.deepEqual(normalizeCompatibleCategories(["mountain", "invalid", "event"]), [
    "mountain",
    "event",
  ]);
});

test("migrateLegacyEquipmentCategory maps enum slug only", () => {
  assert.deepEqual(migrateLegacyEquipmentCategory("mountain"), ["mountain"]);
  assert.deepEqual(migrateLegacyEquipmentCategory("ایمنی"), []);
});
