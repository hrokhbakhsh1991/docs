/**
 * SMK-P9-TL-ADMIN — operator tour list admin directory layout.
 */
import { expect, test } from "@playwright/test";

import { TOURS_LIST_TEST_IDS } from "../../src/features/tours/query-model";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";

test.describe("operator tours list — admin directory", () => {
  test.beforeEach(async ({ page }) => {
    await loginOperatorOwner(page);
  });

  test("desktop table renders without cover imagery", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.page)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.tableDesktop)).toBeVisible();
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.tableMobile)).toBeHidden();
    await expect(
      page.getByTestId(TOURS_LIST_TEST_IDS.tableDesktop).getByTestId(TOURS_LIST_TEST_IDS.row).first()
    ).toBeVisible();
    await expect(page.locator("[data-operator-tours-table]")).toBeVisible();
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.cardCover)).toHaveCount(0);
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.search)).toBeVisible();
  });

  test("mobile compact rows render without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.page)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.tableDesktop)).toBeHidden();
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.tableMobile)).toBeVisible();
    await expect(
      page.getByTestId(TOURS_LIST_TEST_IDS.tableMobile).getByTestId(TOURS_LIST_TEST_IDS.row).first()
    ).toBeVisible();
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.cardCover)).toHaveCount(0);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("Persian RTL list keeps controls usable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.controls)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByTestId(TOURS_LIST_TEST_IDS.tableDesktop).getByTestId(TOURS_LIST_TEST_IDS.rowActions).first()
    ).toBeVisible();
  });
});
