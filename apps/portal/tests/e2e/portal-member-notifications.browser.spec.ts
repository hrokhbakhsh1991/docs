/**
 * MNI / NOTIF-BQC — portal member notifications browser closure (Postgres).
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForEngagement } from "./fixtures/authenticate-portal-member-for-engagement";
import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";
import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";
import { ensurePortalSmokeDeeplinkNotification } from "./fixtures/ensure-portal-smoke-deeplink-notifications";
import {
  ensurePortalSmokeEventMatrixNotifications,
  getPortalSmokeEventMatrixMatchers,
} from "./fixtures/ensure-portal-smoke-event-matrix-notifications";
import { ensurePortalSmokeMemberHasUnreadNotifications } from "./fixtures/ensure-portal-smoke-member-has-unread-notifications";
import { ensurePortalSmokeMemberHasPaginatedNotifications } from "./fixtures/ensure-portal-smoke-member-has-paginated-notifications";
import {
  DENALI_PROFILE_BIRTH_DATE,
  DENALI_PROFILE_FATHER_NAME,
  DENALI_PROFILE_NATIONAL_ID,
  gotoMemberProfile,
  saveMemberProfileFields,
} from "./fixtures/portal-member-profile";
import {
  fetchUnreadNotificationCount,
  gotoMemberNotificationsReady,
  NOTIFICATIONS_PANEL_READY,
  NOTIFICATIONS_PAGE_READY,
  notificationBellBadge,
  unreadNotificationItems,
} from "./fixtures/portal-member-notifications";

const MEMBER_PHONE = "+15550001003";
const MEMBER_NAME = "Smoke Member";

test.describe("portal member notifications — NOTIF-BQC", () => {
  test.describe.configure({ mode: "serial" });
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

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-inbox-desktop.png", { fullPage: true });
  });

  test("NOTIF-BQC-12 mobile RTL inbox layout screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);
    await gotoMemberNotificationsReady(page);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-inbox-mobile-rtl.png", { fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("NOTIF-BQC-WALK bell badge on tickets page screenshot", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-tickets]")).toBeVisible({ timeout: 90_000 });
    await expect(notificationBellBadge(page)).toBeVisible({ timeout: 30_000 });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-bell-on-tickets.png", { fullPage: true });
  });

  test("NOTIF-BQC-02 marks a single unread notification read and persists after reload", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);

    const unreadBefore = await fetchUnreadNotificationCount(page);
    expect(unreadBefore).toBeGreaterThan(0);

    await gotoMemberNotificationsReady(page);

    const firstUnread = unreadNotificationItems(page).first();
    await expect(firstUnread).toBeVisible();
    const notificationId = await firstUnread.getAttribute("data-portal-member-notification-item");
    expect(notificationId).toBeTruthy();

    await firstUnread.locator("[data-portal-member-notification-link]").click();
    await page.waitForURL(
      (url) => !url.pathname.endsWith("/me/notifications"),
      { timeout: 60_000 }
    );

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

    const ticketsRes = await page.request.get("/api/me/tickets?limit=20");
    expect(ticketsRes.ok(), await ticketsRes.text()).toBeTruthy();
    const ticketsBody = (await ticketsRes.json()) as {
      readonly ok?: boolean;
      readonly list?: { readonly items?: ReadonlyArray<{ readonly id: string }> };
    };
    const ticketId = ticketsBody.list?.items?.[0]?.id;
    expect(ticketId, "smoke member must have at least one ticket for deeplink proof").toBeTruthy();

    await gotoMemberNotificationsReady(page);

    const ticketItem = page
      .locator(`[data-portal-member-notification-source="ticketing"] a[href="/me/tickets/${ticketId}"]`)
      .first();
    await expect(ticketItem).toBeVisible({ timeout: 30_000 });

    const href = await ticketItem.getAttribute("href");
    expect(href).toMatch(/^\/me\/tickets\/.+/);

    await ticketItem.click();
    await page.waitForURL(/\/me\/tickets\//, { timeout: 60_000 });
    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']")
    ).toBeVisible({
      timeout: 90_000,
    });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-ticket-deeplink.png", { fullPage: true });
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

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-all-read.png", { fullPage: true });

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

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-skeleton-loading.png", { fullPage: true });

    await expect(page.locator(NOTIFICATIONS_PANEL_READY)).toBeVisible({ timeout: 60_000 });
  });

  test("NOTIF-BQC-07 error state shows retry and recovers inbox", async ({ page }) => {
    // Partial realness: first list fetch stubbed 500; retry uses real BFF + Postgres inbox.
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

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-error-retry.png", { fullPage: true });

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

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-empty-state.png", { fullPage: true });

    const unread = await fetchUnreadNotificationCount(page);
    expect(unread).toBe(0);
  });
});

test.describe("portal member notifications — deep links", () => {
  test("NOTIF-BQC-09 wallet notification deep-links to wallet page", async ({ page }) => {
    ensurePortalSmokeDeeplinkNotification("wallet");
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await gotoMemberNotificationsReady(page);

    const walletItem = page.locator('[data-portal-member-notification-source="wallet"]').first();
    await expect(walletItem).toBeVisible({ timeout: 30_000 });

    const href = await walletItem.locator("[data-portal-member-notification-link]").getAttribute("href");
    expect(href).toBe("/me/wallet");

    await walletItem.locator("[data-portal-member-notification-link]").click();
    await page.waitForURL(/\/me\/wallet/, { timeout: 60_000 });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-wallet-deeplink.png", { fullPage: true });
  });

  test("NOTIF-BQC-10 booking notification deep-links to registrations page", async ({ page }) => {
    ensurePortalSmokeDeeplinkNotification("booking");
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await gotoMemberNotificationsReady(page);

    const bookingItem = page.locator('[data-portal-member-notification-source="booking"]').first();
    await expect(bookingItem).toBeVisible({ timeout: 30_000 });

    const href = await bookingItem.locator("[data-portal-member-notification-link]").getAttribute("href");
    expect(href).toBe("/me/registrations");

    await bookingItem.locator("[data-portal-member-notification-link]").click();
    await page.waitForURL(/\/me\/registrations/, { timeout: 60_000 });
    await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({ timeout: 90_000 });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-booking-deeplink.png", { fullPage: true });
  });
});

test.describe("portal member notifications — locale and auth", () => {
  test("NOTIF-BQC-11 English LTR inbox layout", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);

    await page.evaluate(() => {
      document.cookie = "NEXT_LOCALE=en;path=/;max-age=31536000;SameSite=Lax";
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(page.locator(NOTIFICATIONS_PAGE_READY)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(NOTIFICATIONS_PANEL_READY)).toBeVisible({ timeout: 60_000 });

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("h1")).toContainText(/notification/i);
    await expect(page.locator("[data-portal-member-notifications-toolbar]")).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-inbox-english-ltr.png", { fullPage: true });
  });

  test("NOTIF-BQC-20 unauthenticated user redirected from notifications", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
  });
});

test.describe("portal member notifications — event matrix", () => {
  test("NOTIF-BQC-16 booking event matrix renders source chips", async ({ page }) => {
    ensurePortalSmokeEventMatrixNotifications("booking");
    const matchers = getPortalSmokeEventMatrixMatchers("booking");
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await gotoMemberNotificationsReady(page);

    for (const matcher of matchers) {
      await expect(
        page
          .locator('[data-portal-member-notification-source="booking"]')
          .filter({ hasText: matcher })
          .first()
      ).toBeVisible({ timeout: 30_000 });
    }
    await expect(page.locator('[data-portal-member-notification-source="booking"]').first()).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-booking-event-matrix.png", { fullPage: true });
  });

  test("NOTIF-BQC-17 finance event matrix renders source chips", async ({ page }) => {
    ensurePortalSmokeEventMatrixNotifications("finance");
    const matchers = getPortalSmokeEventMatrixMatchers("finance");
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await gotoMemberNotificationsReady(page);

    for (const matcher of matchers) {
      await expect(
        page
          .locator('[data-portal-member-notification-source="finance"]')
          .filter({ hasText: matcher })
          .first()
      ).toBeVisible({ timeout: 30_000 });
    }
    await expect(page.locator('[data-portal-member-notification-source="finance"]').first()).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-finance-event-matrix.png", { fullPage: true });
  });

  test("NOTIF-BQC-18 ticketing event matrix renders source chips", async ({ page }) => {
    ensurePortalSmokeEventMatrixNotifications("ticketing");
    const matchers = getPortalSmokeEventMatrixMatchers("ticketing");
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await gotoMemberNotificationsReady(page);

    for (const matcher of matchers) {
      await expect(
        page
          .locator('[data-portal-member-notification-source="ticketing"]')
          .filter({ hasText: matcher })
          .first()
      ).toBeVisible({ timeout: 30_000 });
    }
    await expect(page.locator('[data-portal-member-notification-source="ticketing"]').first()).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-ticketing-event-matrix.png", { fullPage: true });
  });
});

test.describe("portal member notifications — cross-module", () => {
  test("NOTIF-BQC-14 engagement badge notification appears in inbox", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const email = `notif-bqc-14-${Date.now()}@denali-smoke.local`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Notif Engagement BQC",
    });

    await gotoMemberProfile(page);
    await saveMemberProfileFields(page, {
      email,
      nationalId: DENALI_PROFILE_NATIONAL_ID,
      fatherName: DENALI_PROFILE_FATHER_NAME,
      birthDate: DENALI_PROFILE_BIRTH_DATE,
      gender: "female",
    });

    await expect
      .poll(
        async () => {
          const res = await page.request.get("/api/me/notifications");
          if (!res.ok()) {
            return false;
          }
          const body = (await res.json()) as {
            items?: readonly { sourceModule?: string }[];
          };
          return (body.items ?? []).some((item) => item.sourceModule === "engagement");
        },
        { timeout: 90_000 },
      )
      .toBe(true);

    await gotoMemberNotificationsReady(page);
    await expect(
      page
        .locator(
          "[data-portal-member-notification-item][data-portal-member-notification-source='engagement']",
        )
        .first(),
    ).toBeVisible({ timeout: 60_000 });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-engagement-inbox.png", { fullPage: true });
  });

  test("NOTIF-BQC-15 wallet notification deep-link lands on ready wallet panel", async ({ page }) => {
    ensurePortalSmokeDeeplinkNotification("wallet");
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await gotoMemberNotificationsReady(page);

    const walletItem = page.locator('[data-portal-member-notification-source="wallet"]').first();
    await expect(walletItem).toBeVisible({ timeout: 30_000 });

    await walletItem.locator("[data-portal-member-notification-link]").click();
    await page.waitForURL(/\/me\/wallet/, { timeout: 60_000 });

    const walletProbe = await page.request.get("/api/me/wallet");
    expect(walletProbe.ok(), await walletProbe.text()).toBeTruthy();

    await expect(
      page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-wallet-panel-ready.png", { fullPage: true });
  });
});

test.describe("portal member notifications — pagination", () => {
  test("NOTIF-BQC-19 load-more fetches additional inbox rows", async ({ page }) => {
    ensurePortalSmokeMemberHasPaginatedNotifications();
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });

    const firstPage = await page.request.get("/api/me/notifications?limit=20");
    expect(firstPage.ok()).toBeTruthy();
    const firstBody = (await firstPage.json()) as {
      items?: unknown[];
      hasMore?: boolean;
      nextCursor?: string | null;
    };
    expect(firstBody.items?.length).toBe(20);
    expect(firstBody.hasMore).toBe(true);
    expect(typeof firstBody.nextCursor).toBe("string");

    const secondPage = await page.request.get(
      `/api/me/notifications?limit=20&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
    );
    expect(secondPage.ok()).toBeTruthy();
    const secondBody = (await secondPage.json()) as { items?: unknown[]; hasMore?: boolean };
    const expectedTotal = (firstBody.items?.length ?? 0) + (secondBody.items?.length ?? 0);

    await gotoMemberNotificationsReady(page);
    await expect(page.locator("[data-portal-member-notification-item]")).toHaveCount(20);

    const loadMore = page.locator("[data-portal-member-notifications-load-more]");
    await expect(loadMore).toBeVisible();
    await loadMore.click();

    await expect(page.locator("[data-portal-member-notification-item]")).toHaveCount(expectedTotal, {
      timeout: 60_000,
    });
    await expect(loadMore).toHaveCount(0, { timeout: 60_000 });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-pagination-load-more.png", {
      fullPage: true,
    });
  });
});
