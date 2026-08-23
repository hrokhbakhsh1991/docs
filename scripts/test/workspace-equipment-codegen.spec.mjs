import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspaceEquipmentCapabilities,
  generateWorkspaceEquipmentFieldModuleBindings,
} from "../codegen/workspace-registry/domains/equipment.mjs";

describe("workspace equipment codegen (CW7-02)", () => {
  it("emits denali capability flags from workspaceEquipment block", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceEquipment?.supported, true);

    const generated = generateWorkspaceEquipmentCapabilities(manifests);
    assert.match(generated, /operatorSettings: true as const/);
    assert.match(generated, /guestLandingSection: false as const/);
    assert.match(generated, /"denali":/);
  });

  it("isolates workspaces without equipment block", () => {
    const manifests = discoverManifests();
    const starter = manifests.find((manifest) => manifest.id === "starter");
    assert.ok(starter);
    assert.equal(starter.workspaceEquipment, undefined);

    const generated = generateWorkspaceEquipmentCapabilities(manifests);
    for (const workspaceId of ["starter", "urban", "guest-club"]) {
      assert.equal(generated.includes(`"${workspaceId}":`), false);
    }
  });

  it("emits denali fieldModule binding when wizardTourField enabled (CW7-03)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceEquipment?.capabilities?.wizardTourField, true);
    assert.ok(denali.workspaceEquipment?.fieldModule);

    const generated = generateWorkspaceEquipmentFieldModuleBindings(manifests);
    assert.match(generated, /denaliEquipmentFieldRegistryFragment/);
    assert.match(generated, /"denali"/);
    assert.match(generated, /resolveWorkspaceEquipmentFieldRegistryFragment/);
  });

  it("isolates field-module bindings for workspaces without equipment block (CW7-03)", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceEquipmentFieldModuleBindings(manifests);
    for (const workspaceId of ["starter", "urban", "guest-club"]) {
      assert.equal(generated.includes(`workspaceType: "${workspaceId}"`), false);
    }
    assert.match(generated, /WORKSPACE_EQUIPMENT_FIELD_MODULE_BINDINGS/);
  });
});
