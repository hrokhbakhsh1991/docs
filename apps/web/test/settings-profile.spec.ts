/**
 * Phase 9.6 — profile settings web (S9-R7)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isProfileDisplayNameValid,
  resolveProfileDisplayName,
} from "../src/features/settings/profile-settings-logic";
import { validateOperatorAvatarFile } from "../src/features/settings/validate-operator-avatar-file";
import {
  groupSettingsModulesByNav,
  hrefForSettingsModule,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import {
  SETTINGS_HUB_TEST_IDS,
  SETTINGS_MODULE_LABEL_KEYS,
} from "../src/features/settings/settings-module-types";

describe("settings-profile.spec.ts — Phase 9.6", () => {
  it("WEB-9.6-ME-01 profile test ids and validation", () => {
    assert.equal(SETTINGS_HUB_TEST_IDS.profilePage, "operator-settings-profile-page");
    assert.equal(SETTINGS_HUB_TEST_IDS.profileForm, "operator-settings-profile-form");
    assert.equal(SETTINGS_HUB_TEST_IDS.profileSave, "operator-settings-profile-save");
    assert.equal(SETTINGS_HUB_TEST_IDS.profileAvatar, "operator-settings-profile-avatar");
    assert.equal(SETTINGS_HUB_TEST_IDS.profileAvatarUpload, "operator-settings-profile-avatar-upload");
    assert.equal(isProfileDisplayNameValid("Ops lead"), true);
    assert.equal(isProfileDisplayNameValid("   "), false);
    assert.equal(validateOperatorAvatarFile(new File([], "empty.png", { type: "image/png" })), "PROFILE_AVATAR_EMPTY");
    assert.equal(resolveProfileDisplayName({ displayName: "", mobile: "+15550001001" }), "+15550001001");
  });

  it("WEB-9.6-ME-02 avatar validation rejects unsupported types", () => {
    assert.equal(
      validateOperatorAvatarFile(new File([new Uint8Array([1, 2, 3])], "bad.svg", { type: "image/svg+xml" })),
      "PROFILE_AVATAR_TYPE_INVALID"
    );
  });

  it("WEB-9.6-ME-03 account module appears first in settings hub nav", () => {
    const modules = [
      {
        id: "account_profile",
        kind: "account_preference" as const,
        route: "settings/me",
        ability: "operator.settings.account_profile",
        nav: { group: "account" as const, labelKey: "settings.account_profile" },
      },
      {
        id: "equipment",
        kind: "reference_data" as const,
        route: "settings/equipment",
        ability: "operator.settings.equipment",
        nav: { group: "workspace" as const, labelKey: "settings.equipment" },
      },
    ];

    const groups = groupSettingsModulesByNav(modules);
    assert.equal(groups[0]?.group, "account");
    assert.equal(groups[0]?.modules[0]?.id, "account_profile");
    assert.equal(labelForSettingsModule(modules[0]!), SETTINGS_MODULE_LABEL_KEYS.account_profile);
    assert.equal(hrefForSettingsModule(modules[0]!), "/settings/me");
  });

  it("WEB-9.6-ME-04 reconciliation triage hub link", () => {
    const module = {
      id: "reconciliation_triage",
      kind: "readonly_explorer" as const,
      route: "settings/reconciliation-triage",
      ability: "operator.settings.reconciliation_triage",
      nav: { group: "finance_ops" as const, labelKey: "settings.reconciliation_triage" },
    };
    assert.equal(labelForSettingsModule(module), SETTINGS_MODULE_LABEL_KEYS.reconciliation_triage);
    assert.equal(hrefForSettingsModule(module), "/settings/reconciliation-triage");
  });
});
