/**
 * Phase 9.6 — tour presets advanced UI (R7)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPresetsAdvancedPutBody,
  isPresetsAdvancedPersisted,
  parsePresetsAdvancedResponse,
} from "../src/features/settings/presets-advanced-logic";
import {
  PRESETS_ADVANCED_CONFIG_VERSION,
  PRESETS_ADVANCED_TEST_IDS,
} from "../src/features/settings/presets-advanced-types";
import {
  hrefForSettingsModule,
  isSettingsPilotModule,
  isTourPresetsAdvancedModuleSupported,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import {
  SETTINGS_HUB_TEST_IDS,
  SETTINGS_MODULE_LABEL_KEYS,
} from "../src/features/settings/settings-module-types";

describe("settings-presets-advanced.spec.ts — Phase 9.6 Web", () => {
  it("WEB-9.6-PRA-01 presets advanced module and save body", () => {
    assert.equal(isTourPresetsAdvancedModuleSupported("tour_presets_advanced"), true);
    assert.equal(isSettingsPilotModule("tour_presets_advanced"), true);
    assert.equal(PRESETS_ADVANCED_TEST_IDS.page, SETTINGS_HUB_TEST_IDS.presetsAdvancedPage);
    assert.equal(PRESETS_ADVANCED_TEST_IDS.saveButton, "operator-presets-advanced-save");

    const module = {
      id: "tour_presets_advanced",
      kind: "tenant_config" as const,
      route: "settings/tour-presets/advanced",
      ability: "operator.settings.tour_presets_advanced",
      nav: { group: "templates" as const, labelKey: "settings.tour_presets_advanced" },
      configKey: "presets_advanced",
      configVersion: 1,
    };
    assert.equal(labelForSettingsModule(module), SETTINGS_MODULE_LABEL_KEYS.tour_presets_advanced);
    assert.equal(hrefForSettingsModule(module), "/settings/tour-presets/advanced");

    const body = buildPresetsAdvancedPutBody({
      autoMatchEnabled: true,
      defaultPresetId: "preset-smk-01",
      matchRules: [
        {
          id: "rule-1",
          tourType: "day",
          themeId: null,
          presetId: "preset-smk-01",
          enabled: true,
        },
      ],
    });
    assert.equal(body.configVersion, PRESETS_ADVANCED_CONFIG_VERSION);
    const payload = body.payload as Record<string, unknown>;
    assert.equal(payload.autoMatchEnabled, true);
    assert.equal(payload.defaultPresetId, "preset-smk-01");

    const parsed = parsePresetsAdvancedResponse({
      configKey: "presets_advanced",
      configVersion: 1,
      source: "tenant",
      updatedAt: new Date().toISOString(),
      payload: {
        autoMatchEnabled: true,
        defaultPresetId: "preset-smk-01",
        matchRules: [
          {
            id: "rule-1",
            tourType: "day",
            themeId: null,
            presetId: "preset-smk-01",
            enabled: true,
          },
        ],
      },
    });
    assert.equal(parsed.autoMatchEnabled, true);
    assert.equal(
      isPresetsAdvancedPersisted({ autoMatchEnabled: false, defaultPresetId: null, matchRules: [] }, parsed),
      true
    );
  });
});
