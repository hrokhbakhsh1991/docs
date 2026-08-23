import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  completeGuestPdpRegisterModalThenOpenPortalIntake,
} from "./fixtures/catalog-registration-otp";
import { resolveSmokePublishedTourId } from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();
const WIDTHS = [360, 768, 1024, 1440] as const;
const HEIGHT = 1000;
const PORTAL_ORIGIN = "http://portal.denali.localhost:3003";
const SCREENSHOT_DIR = join(process.cwd(), "../../.artifacts/prod7/responsive-widths");

async function assertNoHorizontalOverflow(
  page: Page,
  label: string,
  width: number,
  testInfo: TestInfo
): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("body").waitFor({ state: "visible", timeout: 90_000 });
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
  }));
  const overflow = Math.max(
    metrics.bodyScrollWidth - metrics.bodyClientWidth,
    metrics.documentScrollWidth - metrics.documentClientWidth
  );
  expect(
    overflow,
    `${label} has horizontal overflow at ${width}px: ${JSON.stringify(metrics)}`
  ).toBeLessThanOrEqual(2);

  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = join(SCREENSHOT_DIR, `${label}-${width}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  testInfo.attachments.push({
    name: `${label}-${width}`,
    path: screenshotPath,
    contentType: "image/png",
  });
}

test.describe("PROD-7 R7-24 live responsive smoke", () => {
  test("critical Marketing and Portal routes have no horizontal overflow at required widths", async ({
    page,
  }, testInfo) => {
    test.setTimeout(420_000);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });

      await page.goto("/tours", { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-marketing-catalog]")).toBeVisible({
        timeout: 120_000,
      });
      await assertNoHorizontalOverflow(page, "marketing-catalog-list", width, testInfo);

      await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
        timeout: 120_000,
      });
      await assertNoHorizontalOverflow(page, "marketing-tour-detail", width, testInfo);
    }

    await page.setViewportSize({ width: 1440, height: HEIGHT });
    await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await completeGuestPdpRegisterModalThenOpenPortalIntake(page, {
      phone: `09127${Date.now().toString().slice(-6)}`,
      fullName: "Responsive Smoke Guest",
    });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });

      await expect(
        page.locator("[data-public-registration-intake][data-registration-ready]")
      ).toBeVisible({
        timeout: 120_000,
      });
      await assertNoHorizontalOverflow(page, "portal-registration-intake", width, testInfo);
    }

    const phone = `09127${Date.now().toString().slice(-6)}`;
    await completeCatalogRegistrationIntake(page, {
      phone,
      email: `responsive-${Date.now()}@smoke.local`,
      fullName: "Responsive Smoke Guest",
    });
    await expect(page.locator("[data-public-registration-success]")).toBeVisible({
      timeout: 90_000,
    });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(`${PORTAL_ORIGIN}/me/registrations`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
        timeout: 180_000,
      });
      await assertNoHorizontalOverflow(page, "portal-member-registrations", width, testInfo);
    }
  });
});
