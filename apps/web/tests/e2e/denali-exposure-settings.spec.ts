/**
 * Phase 9.7 — Denali exposure settings Playwright smoke (M1 optional).
 *
 * @see docs/architecture/field-exposure-system.md — Phase 9.7
 */
import { expect, test } from "@playwright/test";

import { DENALI_WORKSPACE_SURFACES_TEST_IDS } from "../../src/exposure/DenaliWorkspaceSurfacesPanel";
import { SETTINGS_HUB_TEST_IDS } from "../../src/features/settings/settings-module-types";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";

test.describe("denali-exposure-settings.spec.ts — Phase 9.7 E2E", () => {
  test("SMK-EXP-01 owner reaches exposure settings page", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/settings/exposure", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.exposurePage)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("SMK-EXP-02 denali workspace surfaces panel renders for denali tenant", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/settings/exposure", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.exposurePage)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(DENALI_WORKSPACE_SURFACES_TEST_IDS.panel)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(DENALI_WORKSPACE_SURFACES_TEST_IDS.surface).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("SMK-EXP-03 exposure settings links omit locale prefix", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/settings/exposure", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.exposurePage)).toBeVisible({
      timeout: 20_000,
    });

    const integrationsLink = page.locator('a[href="/settings/integrations"]').first();
    await expect(integrationsLink).toBeVisible({ timeout: 15_000 });
    await integrationsLink.click();
    await expect(page).toHaveURL(/\/settings\/integrations(?:\?|$)/, { timeout: 15_000 });
    expect(page.url()).not.toMatch(/\/(en|fa)\/settings\//);
  });
});
