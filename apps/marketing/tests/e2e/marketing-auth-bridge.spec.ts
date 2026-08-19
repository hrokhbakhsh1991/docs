/**
 * Quiet Ledger auth-bridge smoke — PDP modal presentation + copy + a11y.
 * Not wired into SMK-MKT-01 (that suite starts the full smoke stack).
 */
import { expect, test, type Page } from "@playwright/test";

import { DENALI_SMOKE_PUBLISHED_TOUR_ID } from "./fixtures/smoke-published-tour";

const TOUR = `/tours/${DENALI_SMOKE_PUBLISHED_TOUR_ID}`;

async function openPdpModal(page: Page): Promise<void> {
  await page.goto(TOUR, { waitUntil: "load" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-login-modal]")).toBeAttached({ timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const viewportWidth = page.viewportSize()?.width ?? 1440;
  if (viewportWidth >= 1024) {
    await expect(page.locator("[data-marketing-catalog-detail-booking-rail]")).toBeVisible({
      timeout: 15_000,
    });
  }

  const rail = page.locator(
    "[data-marketing-catalog-detail-booking-rail-cta] [data-marketing-register]"
  );
  const sticky = page.locator(
    "[data-marketing-catalog-detail-sticky-cta] [data-marketing-register]"
  );
  const cta = (await rail.isVisible().catch(() => false)) ? rail : sticky;
  await expect(cta).toBeVisible({ timeout: 15_000 });
  await cta.scrollIntoViewIfNeeded();
  await cta.click();
  await expect(page).toHaveURL(new RegExp(`/tours/${DENALI_SMOKE_PUBLISHED_TOUR_ID}`));
  await expect(page.locator('[data-marketing-login-modal-open="true"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("marketing auth bridge Quiet Ledger", () => {
  test.describe.configure({ retries: 1 });
  test("AB-E2E-01 FA desktop dialog, validation, focus, escape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPdpModal(page);

    const dialog = page.locator("[data-marketing-login-modal]");
    await expect(dialog).toHaveAttribute("data-marketing-login-modal-presentation", "dialog");
    await expect(dialog).toHaveAttribute("data-marketing-login-modal-stage", "phone");
    await expect(page.locator("#marketing-login-modal-title")).toHaveText("ورود");
    await expect(page.locator("[data-marketing-login-modal-close]")).toHaveText("انصراف");
    await expect(page.locator("[data-marketing-login-modal-intro]")).toHaveCount(0);
    await expect(page.locator("#phone")).toBeFocused();

    await page.locator('[data-action="send-code"]').click();
    const alert = page.locator("[data-public-registration-phone] [role='alert']");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("شماره موبایل را وارد کنید.");
    await expect(page.locator("#phone")).toHaveAttribute("aria-invalid", "true");

    await page.keyboard.press("Escape");
    await expect(page.locator('[data-marketing-login-modal-open="true"]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/tours/${DENALI_SMOKE_PUBLISHED_TOUR_ID}`));
  });

  test("AB-E2E-02 FA 768 dialog and 390 sheet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openPdpModal(page);
    await expect(page.locator("[data-marketing-login-modal]")).toHaveAttribute(
      "data-marketing-login-modal-presentation",
      "dialog"
    );
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .locator("[data-marketing-catalog-detail-sticky-cta] [data-marketing-register]")
      .click();
    const dialog = page.locator("[data-marketing-login-modal]");
    await expect(dialog).toHaveAttribute("data-marketing-login-modal-presentation", "sheet");
    await expect(page.locator("#marketing-login-modal-title")).toHaveText("ورود");
    await expect(page.locator("#phone")).toBeFocused();
  });

  test("AB-E2E-03 EN desktop + mobile copy", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en${TOUR}`, { waitUntil: "load" });
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-marketing-login-modal]")).toBeAttached({ timeout: 30_000 });
    const rail = page.locator(
      "[data-marketing-catalog-detail-booking-rail-cta] [data-marketing-register]"
    );
    await rail.click();
    await expect(page.locator("#marketing-login-modal-title")).toHaveText("Sign in");
    await expect(page.locator("[data-marketing-login-modal-close]")).toHaveText("Cancel");
    await expect(page.getByLabel("Mobile")).toBeVisible();
    await expect(page.locator('[data-action="send-code"]')).toHaveText("Send code");

    await page.locator('[data-action="send-code"]').click();
    await expect(page.locator("[data-public-registration-phone] [role='alert']")).toHaveText(
      "Enter a mobile number."
    );

    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .locator("[data-marketing-catalog-detail-sticky-cta] [data-marketing-register]")
      .click();
    await expect(page.locator("[data-marketing-login-modal]")).toHaveAttribute(
      "data-marketing-login-modal-presentation",
      "sheet"
    );
    await expect(page.locator("#marketing-login-modal-title")).toHaveText("Sign in");
  });
});
