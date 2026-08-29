/**
 * Denali Bookings — control bar + pagination responsive regression.
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../src/features/bookings/bookings-command-center-types";
import { loginOperatorOwner } from "./fixtures/operator-owner-session";

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 768 },
  { label: "768", width: 768, height: 1024 },
  { label: "390", width: 390, height: 844 },
] as const;

async function readBookingsMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      docOverflow: doc.scrollWidth > doc.clientWidth,
      bodyOverflow: body.scrollWidth > body.clientWidth,
      hasControls: document.querySelector('[data-testid="operator-bookings-controls"]') !== null,
      hasFiltersToggle:
        document.querySelector('[data-testid="operator-bookings-filters-toggle"]') !== null,
      hasQueueStatus:
        document.querySelector('[data-testid="operator-bookings-queue-status"]') !== null,
      hasPagination:
        document.querySelector('[data-testid="operator-bookings-pagination"]') !== null,
      loadMoreVisible:
        document.querySelector('[data-testid="operator-bookings-load-more"]') !== null,
      presetsHintVisible:
        document.querySelector('[data-testid="operator-bookings-presets-hint"]') !== null,
    };
  });
}

test.describe("bookings-directory-controls-responsive", () => {
  test("WEB-BKG-CTRL layout @ all breakpoints", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/bookings", { waitUntil: "networkidle" });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.controls)).toBeVisible({
      timeout: 15_000,
    });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(200);
      const metrics = await readBookingsMetrics(page);

      expect(metrics.docOverflow, `doc overflow @ ${viewport.label}`).toBe(false);
      expect(metrics.bodyOverflow, `body overflow @ ${viewport.label}`).toBe(false);
      expect(metrics.hasControls, `controls @ ${viewport.label}`).toBe(true);
      expect(metrics.hasFiltersToggle, `filters toggle @ ${viewport.label}`).toBe(true);
      expect(metrics.hasQueueStatus, `queue status @ ${viewport.label}`).toBe(true);
      expect(metrics.loadMoreVisible, `no load-more @ ${viewport.label}`).toBe(false);
      expect(metrics.presetsHintVisible, `no presets hint @ ${viewport.label}`).toBe(false);

      await page.screenshot({
        path: `/opt/cursor/artifacts/bookings-directory-${viewport.label}.png`,
        fullPage: true,
      });
    }

    await page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersToggle).click();
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersPanel)).toBeVisible();
    await page.getByLabel(/پرداخت|Payment/i).selectOption("unpaid");
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.activeFilters)).toBeVisible();

    const paginationVisible = await page
      .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.pagination)
      .isVisible()
      .catch(() => false);
    if (paginationVisible) {
      const nextButton = page.getByRole("button", { name: /Next|بعدی/i });
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
        await expect(page).toHaveURL(/page=2/);
        await page.getByRole("button", { name: /Previous|قبلی/i }).click();
        await page.waitForTimeout(300);
      }
    }

    await page.screenshot({
      path: `/opt/cursor/artifacts/bookings-directory-filters-active-1440.png`,
      fullPage: true,
    });
  });
});
