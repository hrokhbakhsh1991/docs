/**
 * Phase 9.6 — Denali settings manifest (REQ-P9-062 · DEC-P9-009).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { getDenaliOperatorSettingsSurface } from "../src/settings/denali-settings.manifest";

describe("settings-manifest.spec.ts — workspace-denali", () => {
  it("DN-9.6-01 denali manifest includes equipment reference_data module", () => {
    const surface = getDenaliOperatorSettingsSurface();
    const equipment = surface.modules.find((module) => module.id === "equipment");
    assert.ok(equipment);
    assert.equal(equipment.kind, "reference_data");
    assert.equal(equipment.entity, "WorkspaceEquipment");
    assert.equal(getDenaliWorkspacePlugin().operatorSettings?.manifestVersion, 1);
  });
});
