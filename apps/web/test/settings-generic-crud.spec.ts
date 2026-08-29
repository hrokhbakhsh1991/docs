/**
 * Phase 9.6 — generic CRUD web (SMK-P9-08)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupSettingsModulesByNav,
  hrefForSettingsModule,
  isEquipmentModuleSupported,
  isSettingsPilotModule,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import {
  SETTINGS_HUB_TEST_IDS,
  SETTINGS_MODULE_LABEL_KEYS,
} from "../src/features/settings/settings-module-types";

describe("settings-generic-crud.spec.ts — Phase 9.6", () => {
  it("WEB-9.6-CRUD-01 equipment panel renders from manifest", () => {
    assert.equal(SETTINGS_HUB_TEST_IDS.equipmentPage, "operator-settings-equipment-page");
    assert.equal(SETTINGS_HUB_TEST_IDS.equipmentList, "operator-settings-equipment-list");
    assert.equal(SETTINGS_HUB_TEST_IDS.equipmentForm, "operator-settings-equipment-form");
    assert.equal(SETTINGS_HUB_TEST_IDS.equipmentCreate, "operator-settings-equipment-create");
    assert.equal(SETTINGS_HUB_TEST_IDS.equipmentEdit, "operator-settings-equipment-edit");
    assert.equal(
      SETTINGS_HUB_TEST_IDS.equipmentEditSave,
      "operator-settings-equipment-edit-save"
    );
    assert.equal(
      SETTINGS_HUB_TEST_IDS.equipmentEditCancel,
      "operator-settings-equipment-edit-cancel"
    );
    assert.equal(isEquipmentModuleSupported("equipment"), true);
    assert.equal(isEquipmentModuleSupported("tour_themes"), false);
    assert.equal(SETTINGS_MODULE_LABEL_KEYS.equipment, "modules.equipment.title");
  });

  it("WEB-9.6-CRUD-02 dynamic nav includes manifest modules only", () => {
    assert.equal(SETTINGS_HUB_TEST_IDS.page, "operator-settings-hub");
    assert.equal(SETTINGS_HUB_TEST_IDS.moduleCard, "operator-settings-module-card");

    const modules = [
      {
        id: "equipment",
        kind: "reference_data" as const,
        route: "settings/equipment",
        ability: "operator.settings.equipment",
        nav: { group: "workspace" as const, labelKey: "settings.equipment" },
      },
      {
        id: "audit_trail",
        kind: "readonly_explorer" as const,
        route: "settings/audit-trail",
        ability: "operator.settings.audit_trail",
        nav: { group: "finance_ops" as const, labelKey: "settings.audit_trail" },
      },
    ];

    const pilot = modules.filter((module) => isSettingsPilotModule(module.id));
    const groups = groupSettingsModulesByNav(pilot);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.group, "workspace");
    assert.equal(groups[0]?.modules.length, 1);
    assert.equal(groups[1]?.group, "finance_ops");
    assert.equal(groups[1]?.modules[0]?.id, "audit_trail");
    const equipment = pilot.find((module) => module.id === "equipment");
    assert.ok(equipment);
    assert.equal(labelForSettingsModule(equipment!), SETTINGS_MODULE_LABEL_KEYS.equipment);
    assert.equal(hrefForSettingsModule(equipment!), "/settings/equipment");
  });
});
