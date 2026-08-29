/**
 * Denali Users directory — control bar + pagination responsive regression.
 */
import { expect, test } from "@playwright/test";

import { USERS_DIRECTORY_TEST_IDS } from "../src/features/users/users-directory-types";
import { loginOperatorOwner } from "./fixtures/operator-owner-session";

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 768 },
  { label: "768", width: 768, height: 1024 },
  { label: "390", width: 390, height: 844 },
] as const;

async function readControlsMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const controls = document.querySelector('[data-testid="operator-users-controls"]');
    const roleButtonRow = controls?.parentElement?.querySelectorAll(
      '[data-testid="operator-users-role-filter"] button'
    );
    return {
      docOverflow: doc.scrollWidth > doc.clientWidth,
      bodyOverflow: body.scrollWidth > body.clientWidth,
      hasControls: controls !== null,
      roleFilterButtonCount: roleButtonRow?.length ?? 0,
      hasFiltersToggle: document.querySelector('[data-testid="operator-users-filters-toggle"]') !== null,
      hasPagination: document.querySelector('[data-testid="operator-users-pagination"]') !== null,
    };
  });
}

test.describe("users-directory-controls-responsive", () => {
  test("WEB-USERS-CTRL layout @ all breakpoints", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/users", { waitUntil: "networkidle" });
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.controls)).toBeVisible({
      timeout: 15_000,
    });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(200);
      const metrics = await readControlsMetrics(page);

      expect(metrics.docOverflow, `doc overflow @ ${viewport.label}`).toBe(false);
      expect(metrics.bodyOverflow, `body overflow @ ${viewport.label}`).toBe(false);
      expect(metrics.hasControls, `controls @ ${viewport.label}`).toBe(true);
      expect(metrics.hasFiltersToggle, `filters toggle @ ${viewport.label}`).toBe(true);
      expect(metrics.roleFilterButtonCount, `no role button row @ ${viewport.label}`).toBe(0);

      if (viewport.width >= 768) {
        await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.pagination)).toBeVisible();
      }

      await page.screenshot({
        path: `/opt/cursor/artifacts/users-directory-${viewport.label}.png`,
        fullPage: true,
      });
    }

    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.filtersToggle).click();
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.filtersPanel)).toBeVisible();
    await page.getByLabel(/نقش|Role/i).selectOption("admin");
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.activeFilters)).toBeVisible();
    await page.screenshot({
      path: `/opt/cursor/artifacts/users-directory-filters-active-1440.png`,
      fullPage: true,
    });
  });
});
