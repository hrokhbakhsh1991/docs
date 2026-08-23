import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { isKnownEquipmentIconKey } from "@app-tour/workspace-denali/settings/equipment-icon-registry";

import {
  resolveEquipmentIconKeyValidator,
  WORKSPACE_EQUIPMENT_ICON_KEY_VALIDATOR_BINDINGS,
} from "../src/settings/workspace-equipment-icon-key-validator-bindings.generated";

describe("workspace-equipment-icon-key-validator-bindings.spec.ts", () => {
  it("CW2-05-01 binds Denali validator from manifest codegen only", () => {
    const denaliBinding = WORKSPACE_EQUIPMENT_ICON_KEY_VALIDATOR_BINDINGS.find(
      (entry) => entry.workspaceType === "denali"
    );
    assert.ok(denaliBinding);
    assert.equal(denaliBinding?.validateEquipmentIconKey("backpack"), true);
    assert.equal(denaliBinding?.validateEquipmentIconKey("not_a_real_icon"), false);
    assert.equal(resolveEquipmentIconKeyValidator("denali"), denaliBinding?.validateEquipmentIconKey);
    assert.equal(resolveEquipmentIconKeyValidator("urban"), undefined);
  });

  it("CW2-05-02 generated binding preserves Denali registry parity", () => {
    const validator = resolveEquipmentIconKeyValidator("denali");
    assert.ok(validator);
    for (const key of ["backpack", "trekking_poles", "sun"]) {
      assert.equal(validator(key), isKnownEquipmentIconKey(key));
    }
    assert.equal(validator("unknown_icon"), false);
  });

  it("CW2-05-03 settings-registry resolves validator without plugin.operatorSettings", () => {
    const source = readFileSync("src/settings/settings-registry.ts", "utf8");
    assert.doesNotMatch(source, /operatorSettings\?\.validateEquipmentIconKey/);
    assert.match(source, /resolveEquipmentIconKeyValidator/);
  });
});
