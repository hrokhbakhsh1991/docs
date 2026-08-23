/**
 * CW7-04 — equipment isolation (zero surface without workspaceEquipment block).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspaceEquipmentCapabilities,
  generateWorkspaceEquipmentFieldModuleBindings,
  generateWorkspaceEquipmentIconKeyValidatorBindings,
  generateWorkspaceEquipmentSettingsUiBindings,
} from "../codegen/workspace-registry/domains/equipment.mjs";

const ISOLATED_WORKSPACES = ["starter", "guest-club", "urban", "policy-cert"];

describe("cw7-04 equipment isolation", () => {
  it("workspaces without equipment block have zero generated capability bindings", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceEquipmentCapabilities(manifests);
    const fieldBindings = generateWorkspaceEquipmentFieldModuleBindings(manifests);
    const iconValidator = generateWorkspaceEquipmentIconKeyValidatorBindings(manifests);
    const settingsUi = generateWorkspaceEquipmentSettingsUiBindings(manifests);

    for (const workspaceId of ISOLATED_WORKSPACES) {
      const manifest = manifests.find((entry) => entry.id === workspaceId);
      assert.ok(manifest, `missing manifest for ${workspaceId}`);
      const equipment = manifest.workspaceEquipment;
      assert.ok(equipment === undefined || equipment.supported !== true);

      assert.equal(generated.includes(`"${workspaceId}":`), false);
      assert.equal(fieldBindings.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(iconValidator.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(settingsUi.includes(`"${workspaceId}"`), false);
    }
  });

  it("guest-club guestLanding does not auto-enable equipment section", () => {
    const manifests = discoverManifests();
    const guestClub = manifests.find((entry) => entry.id === "guest-club");
    assert.ok(guestClub);
    assert.notEqual(guestClub.guestLanding?.sections?.equipment, true);
  });

  it("denali retains equipment bindings (control)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceEquipment?.supported, true);

    const generated = generateWorkspaceEquipmentCapabilities(manifests);
    const iconValidator = generateWorkspaceEquipmentIconKeyValidatorBindings(manifests);
    assert.match(generated, /"denali":/);
    assert.match(iconValidator, /"denali"/);
  });
});
