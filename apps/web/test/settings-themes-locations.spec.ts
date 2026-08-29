/**
 * Phase 9.6 — tour themes + locations web (R4)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseLocationsResponse } from "../src/features/settings/locations-logic";
import {
  hrefForSettingsModule,
  isLocationsModuleSupported,
  isSettingsPilotModule,
  isTourThemesModuleSupported,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import {
  SETTINGS_HUB_TEST_IDS,
  SETTINGS_MODULE_LABEL_KEYS,
} from "../src/features/settings/settings-module-types";

describe("settings-themes-locations.spec.ts — Phase 9.6 Web", () => {
  it("WEB-9.6-THM-01 tour themes module visible in pilot hub", () => {
    assert.equal(isTourThemesModuleSupported("tour_themes"), true);
    assert.equal(isSettingsPilotModule("tour_themes"), true);
    assert.equal(SETTINGS_MODULE_LABEL_KEYS.tour_themes, "modules.tour_themes.title");
    assert.equal(SETTINGS_HUB_TEST_IDS.tourThemesPage, "operator-settings-tour-themes-page");
    assert.equal(SETTINGS_HUB_TEST_IDS.tourThemesEdit, "operator-settings-tour-themes-edit");
    assert.equal(
      SETTINGS_HUB_TEST_IDS.tourThemesEditSave,
      "operator-settings-tour-themes-edit-save"
    );
    assert.equal(
      SETTINGS_HUB_TEST_IDS.tourThemesEditCancel,
      "operator-settings-tour-themes-edit-cancel"
    );

    const module = {
      id: "tour_themes",
      kind: "reference_data" as const,
      route: "settings/tour-themes",
      ability: "operator.settings.tour_themes",
      nav: { group: "workspace" as const, labelKey: "settings.tour_themes" },
    };
    assert.equal(labelForSettingsModule(module), SETTINGS_MODULE_LABEL_KEYS.tour_themes);
    assert.equal(hrefForSettingsModule(module), "/settings/tour-themes");
  });

  it("WEB-9.6-LOC-01 locations composite payload parses", () => {
    assert.equal(isLocationsModuleSupported("locations"), true);
    assert.equal(SETTINGS_HUB_TEST_IDS.locationsPage, "operator-settings-locations-page");

    const parsed = parseLocationsResponse({
      regions: [{ id: "r1", name: "Alps", country: "CH", isActive: true, sortOrder: 0 }],
      destinations: [
        {
          id: "d1",
          regionId: "r1",
          name: "Zermatt",
          locationType: null,
          isActive: true,
          sortOrder: 0,
        },
      ],
      total: 2,
    });
    assert.equal(parsed.regions.length, 1);
    assert.equal(parsed.destinations[0]?.name, "Zermatt");
  });
});
