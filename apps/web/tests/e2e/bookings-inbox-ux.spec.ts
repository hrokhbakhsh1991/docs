/**
 * BQC — Bookings inbox UX (column header + row scan affordances).
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";

test.describe("bookings-inbox-ux.spec.ts", () => {
  test.setTimeout(180_000);

  test("RES-UX-01 desktop: inbox column header and row structure", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginOperatorOwner(page);
    await page.goto("/bookings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });

    const inbox = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox);
    await expect(inbox).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxColumnHeader)).toBeVisible();
    const firstRow = inbox.locator("[data-booking-row]").first();
    if ((await firstRow.count()) > 0) {
      await expect(firstRow.locator("[data-operator-booking-row-guest]")).toBeVisible();
      await expect(firstRow.locator("[data-operator-booking-row-tour]")).toBeVisible();
      await expect(firstRow.locator("[data-operator-booking-row-status]")).toBeVisible();
      await expect(
        firstRow
          .locator("[data-operator-booking-payment-due-at]")
          .or(firstRow.locator("[data-operator-booking-row-submitted]"))
      ).toBeVisible();
    }

    await page.screenshot({
      path: "/opt/cursor/artifacts/bookings-inbox-desktop-1440.png",
      fullPage: false,
    });
  });

  test("RES-UX-02 mobile: stacked row without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginOperatorOwner(page);
    await page.goto("/bookings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxColumnHeader)).toBeHidden();
    const inbox = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox);
    await expect(inbox).toBeVisible({ timeout: 30_000 });

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);

    const firstRow = inbox.locator("[data-booking-row]").first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    if ((await firstRow.count()) > 0) {
      await expect(firstRow).toContainText(/\S/);
    }

    await page.screenshot({
      path: "/opt/cursor/artifacts/bookings-inbox-mobile-390.png",
      fullPage: false,
    });
  });
});
