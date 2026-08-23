import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeWorkspaceFieldRegistryWithEquipmentFragments } from "@app-tour/workspace-sdk";
import { resolveWorkspaceEquipmentFieldRegistryFragment } from "../../../../apps/web/src/bootstrap/workspace-equipment-field-module-bindings.generated";

import {
  denaliEquipmentFieldRegistryFragment,
  DENALI_EQUIPMENT_GEAR_CANONICAL_PATH,
} from "../src/field-registry/denali-equipment-field-module";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";

describe("denali-equipment-field-parity (CW7-03)", () => {
  it("manifest fieldModule fragment contains gear canonical path only", () => {
    assert.equal(denaliEquipmentFieldRegistryFragment.fields.length, 1);
    assert.equal(
      denaliEquipmentFieldRegistryFragment.fields[0]?.canonicalPath,
      DENALI_EQUIPMENT_GEAR_CANONICAL_PATH
    );
  });

  it("fragment matches full registry gear row (Denali parity golden)", () => {
    const fullRegistry = buildDenaliWorkspaceFieldRegistry();
    const gearFromFull = fullRegistry.fields.find(
      (field) => field.canonicalPath === DENALI_EQUIPMENT_GEAR_CANONICAL_PATH
    );
    assert.ok(gearFromFull);
    assert.deepEqual(denaliEquipmentFieldRegistryFragment.fields[0], gearFromFull);
  });

  it("codegen binding resolves denali fragment; starter isolated", () => {
    const denaliFragment = resolveWorkspaceEquipmentFieldRegistryFragment("denali");
    assert.ok(denaliFragment);
    assert.equal(denaliFragment?.fields.length, 1);
    assert.equal(resolveWorkspaceEquipmentFieldRegistryFragment("starter"), undefined);
    assert.equal(resolveWorkspaceEquipmentFieldRegistryFragment("urban"), undefined);
    assert.equal(resolveWorkspaceEquipmentFieldRegistryFragment("guest-club"), undefined);
  });

  it("merge seam replaces gear row without duplicating ids", () => {
    const base = buildDenaliWorkspaceFieldRegistry();
    const merged = mergeWorkspaceFieldRegistryWithEquipmentFragments(
      base,
      denaliEquipmentFieldRegistryFragment
    );
    assert.equal(merged.fields.length, base.fields.length);
    const gearMerged = merged.fields.find(
      (field) => field.canonicalPath === DENALI_EQUIPMENT_GEAR_CANONICAL_PATH
    );
    assert.ok(gearMerged);
    assert.deepEqual(gearMerged, denaliEquipmentFieldRegistryFragment.fields[0]);
  });
});
