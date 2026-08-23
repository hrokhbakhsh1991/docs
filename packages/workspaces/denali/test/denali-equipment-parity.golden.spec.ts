import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  DENALI_EQUIPMENT_GEAR_CANONICAL_PATH,
  denaliEquipmentFieldModule,
  denaliEquipmentFieldRegistryFragment,
} from "../src/field-registry/denali-equipment-field-module";

describe("denali-equipment-parity.golden.spec (CW7-03)", () => {
  it("tour-field module matches denaliFieldRegistryData gear row", () => {
    const gearRow = DENALI_FIELD_DEFINITIONS.find(
      (row) => row.canonicalPath === DENALI_EQUIPMENT_GEAR_CANONICAL_PATH
    );
    assert.ok(gearRow);

    const fragmentField = denaliEquipmentFieldModule.fields[0];
    assert.equal(fragmentField.canonicalPath, gearRow.canonicalPath);
    assert.equal(fragmentField.stepId, gearRow.stepId);
    assert.equal(fragmentField.rhfPath, gearRow.rhfPath);
    assert.equal(fragmentField.zodPath, gearRow.zodPath);
    assert.equal(fragmentField.zodKind, gearRow.zodKind);
    assert.deepEqual(fragmentField.tags, gearRow.tags);
    assert.deepEqual(fragmentField.ruleDefaults, gearRow.ruleDefaults);
    assert.deepEqual(fragmentField.wire, gearRow.wire);
  });

  it("field-registry fragment exposes composite gear row for wizard binding", () => {
    assert.equal(denaliEquipmentFieldModule.moduleId, "workspaceEquipment.tourField");
    assert.equal(denaliEquipmentFieldRegistryFragment.version, 1);
    assert.equal(denaliEquipmentFieldRegistryFragment.fields.length, 1);
    assert.equal(
      denaliEquipmentFieldRegistryFragment.fields[0]?.canonicalPath,
      DENALI_EQUIPMENT_GEAR_CANONICAL_PATH
    );
    assert.equal(denaliEquipmentFieldRegistryFragment.fields[0]?.kind, "composite");
  });
});
