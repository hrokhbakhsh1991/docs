import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseEquipmentIconKeyInput } from "./parse-equipment-icon-key";
import { resolveEquipmentIconKeyValidator } from "./workspace-equipment-icon-key-validator-bindings.generated";
import { SettingsResourceInvalidError } from "./settings-resource-errors";

describe("parseEquipmentIconKeyInput", () => {
  it("preserves Denali valid and invalid key behavior through its injected validator", () => {
    const denaliValidator = resolveEquipmentIconKeyValidator("denali");
    assert.ok(denaliValidator);
    assert.equal(parseEquipmentIconKeyInput("  backpack ", denaliValidator), "backpack");
    assert.throws(
      () => parseEquipmentIconKeyInput("not_a_real_icon", denaliValidator),
      SettingsResourceInvalidError
    );
  });

  it("uses the selected workspace validator without generic Denali knowledge", () => {
    const alpineValidator = (value: string) => value === "alpine_badge";
    assert.equal(parseEquipmentIconKeyInput("alpine_badge", alpineValidator), "alpine_badge");
    assert.throws(
      () => parseEquipmentIconKeyInput("backpack", alpineValidator),
      SettingsResourceInvalidError
    );
    assert.throws(
      () => parseEquipmentIconKeyInput("any_non_empty_key"),
      SettingsResourceInvalidError
    );

    const source = readFileSync("src/settings/parse-equipment-icon-key.ts", "utf8");
    assert.doesNotMatch(source, /workspace-denali|denali/i);
  });

  it("preserves neutral optional-field semantics", () => {
    assert.equal(parseEquipmentIconKeyInput(undefined), undefined);
    assert.equal(parseEquipmentIconKeyInput(null), null);
    assert.equal(
      parseEquipmentIconKeyInput("  ", () => true),
      null
    );
  });
});
