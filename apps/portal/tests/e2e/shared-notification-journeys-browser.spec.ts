/**
 * MNI-001 — browser proof: booking/finance/tour outbox → relay → shared member inbox.
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForEngagement } from "./fixtures/authenticate-portal-member-for-engagement";
import {
  createOperatorNotificationApiContext,
  linkBookingToMember,
  operatorApproveBooking,
  operatorCreatePendingBooking,
  operatorUpdateTourSchedule,
  OPERATOR_SMOKE_SEED_TOUR_ID,
  OPERATOR_SMOKE_TENANT_ID,
} from "./fixtures/operator-notification-api";
import { relayTenantOutboxForTenant } from "./fixtures/relay-tenant-outbox";

async function resolveMemberUserId(
  page: import("@playwright/test").Page,
): Promise<string> {
  const profileRes = await page.request.get("/api/me/profile");
  expect(profileRes.ok(), await profileRes.text()).toBeTruthy();
  const profile = (await profileRes.json()) as {
    profile?: { userId?: string };
  };
  expect(typeof profile.profile?.userId).toBe("string");
  return profile.profile!.userId!;
}

async function expectUnreadIncreased(
  page: import("@playwright/test").Page,
  beforeCount: number,
): Promise<void> {
  await expect
    .poll(async () => {
      const res = await page.request.get("/api/me/notifications/unread-count");
      if (!res.ok()) return beforeCount;
      const body = (await res.json()) as { count?: number };
      return body.count ?? 0;
    })
    .toBeGreaterThan(beforeCount);
}

async function expectInboxSourceVisible(
  page: import("@playwright/test").Page,
  sourceModule: string,
): Promise<void> {
  await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator(
      "[data-portal-member-notifications][data-portal-member-notifications-state='ready']",
    ),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    page.locator(
      `[data-portal-member-notification-item][data-portal-member-notification-source='${sourceModule}']`,
    ).first(),
  ).toBeVisible({ timeout: 60_000 });
}

test.describe("MNI-001 shared notification browser journeys", () => {
  test.setTimeout(240_000);

  test("MNI-BRW-01 registration.approved surfaces booking notification in portal inbox", async ({
    page,
  }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Booking Notification Member",
    });
    const memberUserId = await resolveMemberUserId(page);

    const beforeRes = await page.request.get("/api/me/notifications/unread-count");
    expect(beforeRes.ok()).toBeTruthy();
    const beforeCount = ((await beforeRes.json()) as { count?: number }).count ?? 0;

    const operatorApi = await createOperatorNotificationApiContext();
    try {
      const bookingId = await operatorCreatePendingBooking(operatorApi, {
        guestLabel: `MNI-BRW-01-${Date.now()}`,
      });
      linkBookingToMember({
        tenantId: OPERATOR_SMOKE_TENANT_ID,
        bookingId,
        memberUserId,
      });
      await operatorApproveBooking(operatorApi, bookingId);
    } finally {
      await operatorApi.dispose();
    }

    relayTenantOutboxForTenant(OPERATOR_SMOKE_TENANT_ID);
    await expectUnreadIncreased(page, beforeCount);
    await expectInboxSourceVisible(page, "booking");

    await page.screenshot({
      path: "/opt/cursor/artifacts/shared-notification-booking-approved-en.png",
      fullPage: true,
    });
  });

  test("MNI-BRW-02 payment.hold.scheduled surfaces finance notification after approve", async ({
    page,
  }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Payment Hold Notification Member",
    });
    const memberUserId = await resolveMemberUserId(page);

    const operatorApi = await createOperatorNotificationApiContext();
    try {
      const bookingId = await operatorCreatePendingBooking(operatorApi, {
        guestLabel: `MNI-BRW-02-${Date.now()}`,
      });
      linkBookingToMember({
        tenantId: OPERATOR_SMOKE_TENANT_ID,
        bookingId,
        memberUserId,
      });
      const approved = await operatorApproveBooking(operatorApi, bookingId);
      expect(typeof approved.paymentDueAt).toBe("string");
    } finally {
      await operatorApi.dispose();
    }

    relayTenantOutboxForTenant(OPERATOR_SMOKE_TENANT_ID);
    await expectInboxSourceVisible(page, "finance");

    await page.goto("/?locale=fa", { waitUntil: "domcontentloaded" });
    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator(
        "[data-portal-member-notifications][data-portal-member-notifications-state='ready']",
      ),
    ).toBeVisible({ timeout: 90_000 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/shared-notification-payment-hold-fa-rtl.png",
      fullPage: true,
    });
  });

  test("MNI-BRW-03 tour.schedule.changed fans out booking notification to approved member", async ({
    page,
  }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Tour Schedule Notification Member",
    });
    const memberUserId = await resolveMemberUserId(page);

    const operatorApi = await createOperatorNotificationApiContext();
    try {
      const bookingId = await operatorCreatePendingBooking(operatorApi, {
        guestLabel: `MNI-BRW-03-${Date.now()}`,
        tourId: OPERATOR_SMOKE_SEED_TOUR_ID,
      });
      linkBookingToMember({
        tenantId: OPERATOR_SMOKE_TENANT_ID,
        bookingId,
        memberUserId,
      });
      await operatorApproveBooking(operatorApi, bookingId);
      relayTenantOutboxForTenant(OPERATOR_SMOKE_TENANT_ID);
      await operatorUpdateTourSchedule(operatorApi, OPERATOR_SMOKE_SEED_TOUR_ID);
    } finally {
      await operatorApi.dispose();
    }

    relayTenantOutboxForTenant(OPERATOR_SMOKE_TENANT_ID);

    await expect
      .poll(async () => {
        const res = await page.request.get("/api/me/notifications?limit=20");
        if (!res.ok()) return false;
        const body = (await res.json()) as {
          items?: readonly { sourceModule?: string; eventType?: string }[];
        };
        return (body.items ?? []).some(
          (item) =>
            item.sourceModule === "booking" && item.eventType === "tour.schedule.changed",
        );
      })
      .toBe(true);

    await expectInboxSourceVisible(page, "booking");
    await page.screenshot({
      path: "/opt/cursor/artifacts/shared-notification-tour-schedule-en.png",
      fullPage: true,
    });
  });

  test("MNI-BRW-04 registration.approved awards engagement badge notification in inbox", async ({
    page,
  }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement Notification Member",
    });
    const memberUserId = await resolveMemberUserId(page);

    const operatorApi = await createOperatorNotificationApiContext();
    try {
      const bookingId = await operatorCreatePendingBooking(operatorApi, {
        guestLabel: `MNI-BRW-04-${Date.now()}`,
      });
      linkBookingToMember({
        tenantId: OPERATOR_SMOKE_TENANT_ID,
        bookingId,
        memberUserId,
      });
      await operatorApproveBooking(operatorApi, bookingId);
    } finally {
      await operatorApi.dispose();
    }

    relayTenantOutboxForTenant(OPERATOR_SMOKE_TENANT_ID);

    await expect
      .poll(async () => {
        const res = await page.request.get("/api/me/notifications?limit=20");
        if (!res.ok()) return false;
        const body = (await res.json()) as {
          items?: readonly { sourceModule?: string; eventType?: string }[];
        };
        return (body.items ?? []).some(
          (item) =>
            item.sourceModule === "engagement" && item.eventType === "engagement.badge.earned",
        );
      })
      .toBe(true);

    await expectInboxSourceVisible(page, "engagement");
    await page.screenshot({
      path: "/opt/cursor/artifacts/shared-notification-engagement-badge-en.png",
      fullPage: true,
    });
  });
});
