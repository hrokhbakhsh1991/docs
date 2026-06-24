/**
 * Denali equipment icon registry — closed allowlist + name suggestions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EQUIPMENT_ICON_KEYS,
  isKnownEquipmentIconKey,
  suggestEquipmentIconKey,
} from "../src/settings/equipment-icon-registry";

describe("denali-equipment-icon-registry.spec.ts", () => {
  it("DENALI-EQUIP-ICON-01 registry keys are unique and snake_case", () => {
    const keys = new Set(EQUIPMENT_ICON_KEYS);
    assert.equal(keys.size, EQUIPMENT_ICON_KEYS.length);
    for (const key of EQUIPMENT_ICON_KEYS) {
      assert.match(key, /^[a-z][a-z0-9_]*$/);
      assert.equal(isKnownEquipmentIconKey(key), true);
    }
    assert.equal(isKnownEquipmentIconKey("unknown_icon"), false);
  });

  it("DENALI-EQUIP-ICON-02 suggests trekking poles for Persian baton name", () => {
    assert.equal(suggestEquipmentIconKey("باتوم"), "trekking_poles");
    assert.equal(suggestEquipmentIconKey("Trekking Poles"), "trekking_poles");
  });

  it("DENALI-EQUIP-ICON-03 suggests backpack for common keywords", () => {
    assert.equal(suggestEquipmentIconKey("کوله پشتی"), "backpack");
    assert.equal(suggestEquipmentIconKey(""), null);
  });
});
