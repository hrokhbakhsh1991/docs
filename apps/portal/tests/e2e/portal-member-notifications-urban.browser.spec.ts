/**
 * NOTIF-BQC-21 — Urban workspace notifications surface (memory smoke).
 */
import { expect, test } from "@playwright/test";

import { authenticateUrbanPortalMember } from "./fixtures/authenticate-urban-portal-member";
import {
  NOTIFICATIONS_PAGE_READY,
  NOTIFICATIONS_PANEL_READY,
} from "./fixtures/portal-member-notifications";

test.describe("portal member notifications — urban theme", () => {
  test("NOTIF-BQC-21 urban member notifications inbox uses LTR urban shell", async ({ page }) => {
    await authenticateUrbanPortalMember(page, { fullName: "Urban Notif Member" });

    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(page.locator(NOTIFICATIONS_PAGE_READY)).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('a[href="http://urban.localhost:3002"]')).toBeVisible({
      timeout: 60_000,
    });

    await page.evaluate(() => {
      document.cookie = "NEXT_LOCALE=en;path=/;max-age=31536000;SameSite=Lax";
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.locator(NOTIFICATIONS_PAGE_READY)).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(NOTIFICATIONS_PANEL_READY)).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("h1")).toContainText(/notification/i);
    await expect(
      page.getByRole("link", { name: /notifications|unread/i }).or(page.locator('a[href="/me/notifications"]'))
    ).toBeVisible();

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-urban-ltr-empty.png",
      fullPage: true,
    });
  });
});
