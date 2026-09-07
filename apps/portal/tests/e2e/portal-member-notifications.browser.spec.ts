/**
 * MNI / NOTIF-BQC — portal member notifications browser closure (Postgres).
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";
import { ensurePortalSmokeMemberHasUnreadNotifications } from "./fixtures/ensure-portal-smoke-member-has-unread-notifications";
import {
  fetchUnreadNotificationCount,
  gotoMemberNotificationsReady,
  NOTIFICATIONS_PANEL_READY,
  notificationBellBadge,
  unreadNotificationItems,
} from "./fixtures/portal-member-notifications";

const MEMBER_PHONE = "+15550001003";
const MEMBER_NAME = "Smoke Member";

test.describe.configure({ mode: "serial" });

test.describe("portal member notifications — NOTIF-BQC", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.portal.localhost:3003",
    });
    const page = await context.newPage();
    try {
      await authenticatePortalMemberForTickets(page, {
        phone: MEMBER_PHONE,
        fullName: MEMBER_NAME,
      });
      await ensurePortalSmokeMemberHasUnreadNotifications(page);
    } finally {
      await context.close();
    }
  });

  test("NOTIF-BQC-02 marks a single unread notification read and persists after reload", async ({
    page,
  }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });

    const unreadBefore = await fetchUnreadNotificationCount(page);
    expect(unreadBefore).toBeGreaterThan(0);

    await gotoMemberNotificationsReady(page);

    const firstUnread = unreadNotificationItems(page).first();
    await expect(firstUnread).toBeVisible();
    const notificationId = await firstUnread.getAttribute("data-portal-member-notification-item");
    expect(notificationId).toBeTruthy();

    await firstUnread.locator("[data-portal-member-notification-link]").click();
    await page.waitForURL(/\/me\/tickets\//, { timeout: 60_000 });

    await gotoMemberNotificationsReady(page);

    const readItem = page.locator(
      `[data-portal-member-notification-item="${notificationId}"][data-portal-member-notification-unread="false"]`
    );
    await expect(readItem).toBeVisible({ timeout: 30_000 });

    const unreadAfter = await fetchUnreadNotificationCount(page);
    expect(unreadAfter).toBe(unreadBefore - 1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(NOTIFICATIONS_PANEL_READY)).toBeVisible({ timeout: 60_000 });
    await expect(readItem).toBeVisible();
  });

  test("NOTIF-BQC-04 ticketing notification deep-links to ticket detail", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await gotoMemberNotificationsReady(page);

    const ticketItem = page.locator('[data-portal-member-notification-source="ticketing"]').first();
    await expect(ticketItem).toBeVisible();

    const href = await ticketItem
      .locator("[data-portal-member-notification-link]")
      .getAttribute("href");
    expect(href).toMatch(/^\/me\/tickets\/.+/);

    await ticketItem.locator("[data-portal-member-notification-link]").click();
    await page.waitForURL(/\/me\/tickets\//, { timeout: 60_000 });
    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']")
    ).toBeVisible({
      timeout: 90_000,
    });
  });

  test("NOTIF-BQC-03 mark all read clears toolbar and unread styling", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });

    const unreadBefore = await fetchUnreadNotificationCount(page);
    if (unreadBefore === 0) {
      test.skip(true, "no unread notifications remaining for mark-all scenario");
    }

    await gotoMemberNotificationsReady(page);
    await expect(page.locator("[data-portal-member-notifications-toolbar]")).toBeVisible();

    await page.locator("[data-portal-member-notifications-mark-all]").click();

    await expect(page.locator("[data-portal-member-notifications-toolbar]")).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(unreadNotificationItems(page)).toHaveCount(0);

    const unreadAfter = await fetchUnreadNotificationCount(page);
    expect(unreadAfter).toBe(0);
  });

  test("NOTIF-BQC-06 bell badge clears after mark-all and page reload", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-tickets]")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-testid='portal-member-notification-bell']")).toBeVisible({
      timeout: 60_000,
    });
    await expect(notificationBellBadge(page)).toHaveCount(0);
  });
});

test.describe("portal member notifications — isolated member", () => {
  test("NOTIF-BQC-05 fresh member sees empty inbox state", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: `Notif Empty ${Date.now()}`,
    });

    await gotoMemberNotificationsReady(page);

    await expect(page.locator("[data-portal-member-notifications-empty]")).toBeVisible();
    await expect(page.locator("[data-portal-member-notifications-toolbar]")).toHaveCount(0);
    await expect(page.locator("[data-portal-member-notification-item]")).toHaveCount(0);

    const unread = await fetchUnreadNotificationCount(page);
    expect(unread).toBe(0);
  });
});
