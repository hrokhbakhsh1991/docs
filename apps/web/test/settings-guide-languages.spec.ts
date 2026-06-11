/**
 * Phase 9.6 — guide languages web (R5)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hrefForSettingsModule,
  isGuideLanguagesModuleSupported,
  isSettingsPilotModule,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import {
  SETTINGS_HUB_TEST_IDS,
  SETTINGS_MODULE_LABEL_KEYS,
} from "../src/features/settings/settings-module-types";

describe("settings-guide-languages.spec.ts — Phase 9.6 Web", () => {
  it("WEB-9.6-GLG-01 guide languages module is pilot-visible", () => {
    assert.equal(isGuideLanguagesModuleSupported("guide_languages"), true);
    assert.equal(isSettingsPilotModule("guide_languages"), true);
    assert.equal(SETTINGS_MODULE_LABEL_KEYS.guide_languages, "modules.guide_languages.title");
    assert.equal(
      SETTINGS_HUB_TEST_IDS.guideLanguagesPage,
      "operator-settings-guide-languages-page"
    );

    const module = {
      id: "guide_languages",
      kind: "reference_data" as const,
      route: "settings/guide-languages",
      ability: "operator.settings.guide_languages",
      nav: { group: "workspace" as const, labelKey: "settings.guide_languages" },
    };
    assert.equal(labelForSettingsModule(module), SETTINGS_MODULE_LABEL_KEYS.guide_languages);
    assert.equal(hrefForSettingsModule(module), "/settings/guide-languages");
  });
});
