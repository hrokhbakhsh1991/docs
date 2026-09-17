import { expect, test } from "@playwright/test";

import { resolveSmokePublishedTourId } from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();

async function expectHeaderSignInVisible(page: import("@playwright/test").Page): Promise<void> {
  const headerSignIn = page.locator("a[data-marketing-header-sign-in]").first();
  await expect(headerSignIn).toBeVisible();
  await expect(headerSignIn).toBeEnabled();
  const href = await headerSignIn.getAttribute("href");
  expect(href).toMatch(/\/login(?:\?|$)/);
}

test.describe("SMK-MKT-HEADER-02 logged-out header login visibility", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("desktop 1440 — home and tour detail render visible login CTA", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-header]")).toBeVisible({ timeout: 60_000 });
    await expectHeaderSignInVisible(page);

    await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expectHeaderSignInVisible(page);
  });

  test("mobile 390x844 — login exists in drawer and toolbar icon", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });

    const headerSignIn = page.locator("a[data-marketing-header-sign-in]");
    await expect(headerSignIn.first()).toBeAttached();
    await expect(headerSignIn).toHaveCount(2);

    await page.locator("[data-marketing-nav-drawer] summary").click();
    const drawerSignIn = page.locator(
      "[data-marketing-nav-drawer-panel] a[data-marketing-header-sign-in]"
    );
    await expect(drawerSignIn).toBeVisible();
    await expect(drawerSignIn).toHaveAttribute("href", /\/login(?:\?|$)/);
  });

  test("client-side navigation preserves login CTA", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expectHeaderSignInVisible(page);

    await page.locator(`a[href="/tours/${SMOKE_PUBLISHED_TOUR_ID}"]`).first().click();
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expectHeaderSignInVisible(page);

    await page.locator("[data-marketing-catalog-detail-back]").click();
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expectHeaderSignInVisible(page);
  });

  test("English LTR route renders login CTA", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expectHeaderSignInVisible(page);
    await expect(page.locator("[data-marketing-header-sign-in-label]")).toContainText(/sign in/i);
  });

  test("Persian RTL default route renders login CTA", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expectHeaderSignInVisible(page);
  });

  test("hard refresh preserves login CTA on tour detail", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expectHeaderSignInVisible(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expectHeaderSignInVisible(page);
  });
});
