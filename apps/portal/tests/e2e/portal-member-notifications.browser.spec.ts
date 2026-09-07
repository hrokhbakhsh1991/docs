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

  test("NOTIF-BQC-WALK captures redesigned inbox screenshots (desktop)", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);
    await gotoMemberNotificationsReady(page);

    await expect(page.locator("[data-portal-member-notifications-toolbar]")).toBeVisible();
    await expect(unreadNotificationItems(page).first()).toBeVisible();

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-inbox-desktop.png",
      fullPage: true,
    });
  });

  test("NOTIF-BQC-12 mobile RTL inbox layout screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);
    await gotoMemberNotificationsReady(page);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-inbox-mobile-rtl.png",
      fullPage: true,
    });
  });

  test("NOTIF-BQC-WALK bell badge on tickets page screenshot", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-tickets]")).toBeVisible({ timeout: 90_000 });
    await expect(notificationBellBadge(page)).toBeVisible({ timeout: 30_000 });

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-bell-on-tickets.png",
      fullPage: true,
    });
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

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-ticket-deeplink.png",
      fullPage: true,
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

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-all-read.png",
      fullPage: true,
    });

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
  test("NOTIF-BQC-08 skeleton loading state screenshot", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });

    await page.route("**/api/me/notifications?*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue();
    });

    const loadingPanel = page.locator(
      "[data-portal-member-notifications-panel][data-portal-member-notifications-state='loading']",
    );
    await page.goto("/me/notifications", { waitUntil: "commit" });
    await expect(loadingPanel).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-skeleton-loading.png",
      fullPage: true,
    });

    await expect(page.locator(NOTIFICATIONS_PANEL_READY)).toBeVisible({ timeout: 60_000 });
  });

  test("NOTIF-BQC-07 error state shows retry and recovers inbox", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });

    let failOnce = true;
    await page.route("**/api/me/notifications?*", async (route) => {
      if (failOnce) {
        failOnce = false;
        await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
        return;
      }
      await route.continue();
    });

    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-notifications-error]")).toBeVisible({
      timeout: 60_000,
    });

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-error-retry.png",
      fullPage: true,
    });

    await page.locator("[data-portal-member-notifications-error] button").click();
    await expect(page.locator(NOTIFICATIONS_PANEL_READY)).toBeVisible({ timeout: 60_000 });
  });

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

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-notifications-empty-state.png",
      fullPage: true,
    });

    const unread = await fetchUnreadNotificationCount(page);
    expect(unread).toBe(0);
  });
});
