/**
 * Denali Wave B — operator web browser evidence (DP-2 roster, DP-3 workspace).
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { TOUR_WORKSPACE_TRANSPORT_TEST_IDS } from "../../src/features/tours/tour-workspace-transport-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import { loginOperatorWithPhone, OPERATOR_OWNER_MOBILE } from "../../test/fixtures/operator-owner-session";

const TOUR_DP2 =
  process.env.DP2_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000214";
const EVIDENCE_ROOT =
  process.env.WAVE_B_EVIDENCE_DIR?.trim() ||
  join(process.cwd(), "../../docs/evidence/denali-wave-b/browser-pending");
const BROWSER_DIR = join(EVIDENCE_ROOT, "browser");

function ensureBrowserDir(): void {
  if (!existsSync(BROWSER_DIR)) {
    mkdirSync(BROWSER_DIR, { recursive: true });
  }
}

test.describe("Denali Wave B operator browser evidence", () => {
  test.beforeAll(() => {
    ensureBrowserDir();
  });

  test("DP-2 operational roster transport tab 1440", async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(`/tours/${TOUR_DP2}/workspace?tab=transport`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.transportPanel)).toBeVisible({
      timeout: 120_000,
    });
    await expect(
      page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.filters)
    ).toBeVisible({ timeout: 60_000 });

    await page.screenshot({
      path: join(BROWSER_DIR, "dp2-roster-1440.png"),
      fullPage: true,
    });

    const finalFilter = page.getByRole("button", { name: /final/i });
    if (await finalFilter.isVisible().catch(() => false)) {
      await finalFilter.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: join(BROWSER_DIR, "dp2-roster-filter-final-1440.png"),
        fullPage: true,
      });
    }
  });

  test("DP-3 tour workspace registrations tab", async ({ page }) => {
    const tourId =
      process.env.DP1_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000901";
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(`/tours/${tourId}/workspace?tab=registrations`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 120_000,
    });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-tour-workspace-1440.png"),
      fullPage: true,
    });
  });
});
