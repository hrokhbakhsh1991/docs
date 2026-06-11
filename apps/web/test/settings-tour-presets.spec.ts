/**
 * Phase 9.6 — tour presets web (R6)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hrefForSettingsModule,
  isSettingsPilotModule,
  isTourPresetsModuleSupported,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import {
  SETTINGS_HUB_TEST_IDS,
  SETTINGS_MODULE_LABEL_KEYS,
} from "../src/features/settings/settings-module-types";

describe("settings-tour-presets.spec.ts — Phase 9.6 Web", () => {
  it("WEB-9.6-PRS-01 tour presets module is pilot-visible", () => {
    assert.equal(isTourPresetsModuleSupported("tour_presets"), true);
    assert.equal(isSettingsPilotModule("tour_presets"), true);
    assert.equal(SETTINGS_MODULE_LABEL_KEYS.tour_presets, "modules.tour_presets.title");
    assert.equal(SETTINGS_HUB_TEST_IDS.tourPresetsPage, "operator-settings-tour-presets-page");

    const module = {
      id: "tour_presets",
      kind: "reference_data" as const,
      route: "settings/tour-presets",
      ability: "operator.settings.tour_presets",
      nav: { group: "templates" as const, labelKey: "settings.tour_presets" },
    };
    assert.equal(labelForSettingsModule(module), SETTINGS_MODULE_LABEL_KEYS.tour_presets);
    assert.equal(hrefForSettingsModule(module), "/settings/tour-presets");
  });
});
