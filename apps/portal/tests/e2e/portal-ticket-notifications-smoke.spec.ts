import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";

const MEMBER_PHONE = "+989121234567";
const MEMBER_NAME = "Portal Notification Member";

test.describe("portal ticket notifications — TKT-H1", () => {
  test("member sees bell badge after operator reply notification", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, {
      phone: MEMBER_PHONE,
      fullName: MEMBER_NAME,
    });

    await expect(page.locator("[data-testid='portal-member-notification-bell']")).toBeVisible({
      timeout: 60_000,
    });

    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-notifications][data-portal-member-notifications-state='ready']"),
    ).toBeVisible({ timeout: 60_000 });
  });
});
