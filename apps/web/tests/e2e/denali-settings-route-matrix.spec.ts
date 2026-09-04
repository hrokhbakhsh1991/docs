/**
 * Denali settings route matrix.
 *
 * Every operator-facing settings surface must render its own stable page
 * marker after an authenticated navigation. CRUD behavior remains covered by
 * the focused settings specs.
 */
import { expect, test } from "@playwright/test";

import { AUDIT_TRAIL_TEST_IDS } from "../../src/features/settings/audit-trail-types";
import { SETTINGS_HUB_TEST_IDS } from "../../src/features/settings/settings-module-types";
import { WIZARD_TEMPLATE_TEST_IDS } from "../../src/features/settings/wizard-template-types";
import { RECONCILIATION_TRIAGE_TEST_IDS } from "../../src/finance/reconciliation-triage-logic";
import { WIZARD_DRAFT_AUDIT_TEST_IDS } from "../../src/draft/workspace-draft-audit-logic";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";

const SETTINGS_ROUTES = [
  ["settings hub", "/settings", SETTINGS_HUB_TEST_IDS.page],
  ["profile", "/settings/me", SETTINGS_HUB_TEST_IDS.profilePage],
  ["branding", "/settings/branding", SETTINGS_HUB_TEST_IDS.brandingPage],
  ["equipment", "/settings/equipment", SETTINGS_HUB_TEST_IDS.equipmentPage],
  ["guide languages", "/settings/guide-languages", SETTINGS_HUB_TEST_IDS.guideLanguagesPage],
  ["locations", "/settings/locations", SETTINGS_HUB_TEST_IDS.locationsPage],
  ["tour themes", "/settings/tour-themes", SETTINGS_HUB_TEST_IDS.tourThemesPage],
  ["tour presets", "/settings/tour-presets", SETTINGS_HUB_TEST_IDS.tourPresetsPage],
  [
    "advanced presets",
    "/settings/tour-presets/advanced",
    SETTINGS_HUB_TEST_IDS.presetsAdvancedPage,
  ],
  ["wizard template", "/settings/tour-wizard-template", WIZARD_TEMPLATE_TEST_IDS.page],
  ["wizard drafts", "/settings/wizard-drafts", WIZARD_DRAFT_AUDIT_TEST_IDS.page],
  ["audit trail", "/settings/audit-trail", AUDIT_TRAIL_TEST_IDS.page],
  ["reconciliation triage", "/settings/reconciliation-triage", RECONCILIATION_TRIAGE_TEST_IDS.page],
  ["exposure", "/settings/exposure", SETTINGS_HUB_TEST_IDS.exposurePage],
  [
    "exposure control plane",
    "/settings/exposure/control-plane",
    "operator-settings-exposure-control-plane-page",
  ],
  [
    "exposure simulation",
    "/settings/exposure/simulate",
    "operator-settings-exposure-simulation-page",
  ],
  ["integrations", "/settings/integrations", SETTINGS_HUB_TEST_IDS.integrationsPage],
] as const;

test.describe("Denali settings route matrix", () => {
  for (const [name, path, marker] of SETTINGS_ROUTES) {
    test(`${name} renders after owner login`, async ({ page }) => {
      await loginOperatorOwner(page);

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path} response`).toBe(200);
      await expect(page.getByTestId(marker), `${path} marker`).toBeVisible({ timeout: 30_000 });
    });
  }
});
