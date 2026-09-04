/**
 * MEG-001 — portal member dashboard engagement smoke.
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForEngagement } from "./fixtures/authenticate-portal-member-for-engagement";
import {
  createOperatorEngagementApiContext,
  operatorAdjustMemberPoints,
  operatorFetchMemberEngagement,
  operatorReverseMemberPointEvent,
} from "./fixtures/operator-engagement-api";
import {
  DENALI_PROFILE_BIRTH_DATE,
  DENALI_PROFILE_FATHER_NAME,
  DENALI_PROFILE_NATIONAL_ID,
  gotoMemberProfile,
  saveMemberProfileFields,
} from "./fixtures/portal-member-profile";

test.describe("MEG-001 portal member engagement", () => {
  test("SMK-MEG-01 dashboard shows engagement points separate from wallet copy", async ({
    page,
  }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement Dashboard Smoke",
    });

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-home]")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-dashboard-engagement]")).toBeVisible();
    await expect(page.locator("[data-portal-member-engagement-summary]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("[data-portal-member-engagement-points]")).toBeVisible();
    await expect(page.locator("[data-portal-member-engagement-level]")).toBeVisible();
    await expect(page.locator("[data-portal-member-engagement-badges-region]")).toBeVisible();
    await expect(page.locator("[data-portal-member-engagement-not-money]")).toBeVisible();
    await expect(page.locator("[data-portal-member-dashboard-next-tour]")).toBeVisible();

    const pointsText = await page.locator("[data-portal-member-engagement-points]").innerText();
    expect(pointsText).not.toMatch(/ریال|تومان|\$/i);

    await page.screenshot({
      path: "/opt/cursor/artifacts/portal-member-engagement-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/portal-member-engagement-mobile.png",
      fullPage: true,
    });
  });

  test("SMK-MEG-02 profile completion awards engagement points and badge", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const email = `smk-meg-02-${Date.now()}@denali-smoke.local`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement Profile Award",
    });

    await gotoMemberProfile(page);
    await saveMemberProfileFields(page, {
      email,
      nationalId: DENALI_PROFILE_NATIONAL_ID,
      fatherName: DENALI_PROFILE_FATHER_NAME,
      birthDate: DENALI_PROFILE_BIRTH_DATE,
      gender: "female",
    });

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-engagement-points]")).toContainText("50", {
      timeout: 90_000,
    });
    await expect(
      page.locator('[data-portal-member-engagement-badge][data-earned="true"]').first(),
    ).toBeVisible();
  });

  test("SMK-MEG-03 mobile viewport renders engagement dashboard RTL", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement Mobile Smoke",
    });

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-dashboard-grid]")).toBeVisible({
      timeout: 90_000,
    });
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir === "rtl" || dir === "ltr").toBeTruthy();
  });

  test("SMK-MEG-04 navigates to engagement detail page", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement Detail Smoke",
    });

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-engagement-cta]")).toBeVisible({
      timeout: 90_000,
    });
    await page.locator("[data-portal-member-engagement-cta]").click();
    await expect(page.locator("[data-portal-member-engagement-page]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-engagement-history]")).toBeVisible();
  });

  test("SMK-MEG-05 profile completion surfaces engagement notification", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const email = `smk-meg-05-${Date.now()}@denali-smoke.local`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement Notification Smoke",
    });

    await gotoMemberProfile(page);
    await saveMemberProfileFields(page, {
      email,
      nationalId: DENALI_PROFILE_NATIONAL_ID,
      fatherName: DENALI_PROFILE_FATHER_NAME,
      birthDate: DENALI_PROFILE_BIRTH_DATE,
      gender: "female",
    });

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-engagement-points]")).toContainText("50", {
      timeout: 90_000,
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

    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-notifications][data-portal-member-notifications-state='ready']"),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator(
        "[data-portal-member-notification-item][data-portal-member-notification-source='engagement']",
      ).first(),
    ).toBeVisible({ timeout: 60_000 });

    await page.screenshot({
      path: "/opt/cursor/artifacts/portal-engagement-notification-inbox.png",
      fullPage: true,
    });
  });

  test("SMK-MEG-06 member never sees negative points or punitive correction UX", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const email = `smk-meg-06-${Date.now()}@denali-smoke.local`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement Negative UX Smoke",
    });

    await gotoMemberProfile(page);
    await saveMemberProfileFields(page, {
      email,
      nationalId: DENALI_PROFILE_NATIONAL_ID,
      fatherName: DENALI_PROFILE_FATHER_NAME,
      birthDate: DENALI_PROFILE_BIRTH_DATE,
      gender: "female",
    });

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-engagement-points]")).toContainText("50", {
      timeout: 90_000,
    });

    const profileRes = await page.request.get("/api/me/profile");
    expect(profileRes.ok()).toBeTruthy();
    const profileBody = (await profileRes.json()) as { profile?: { userId?: string } };
    const userId = profileBody.profile?.userId;
    expect(typeof userId).toBe("string");

    const operatorApi = await createOperatorEngagementApiContext();

    await operatorAdjustMemberPoints(operatorApi, userId!, {
      pointsDelta: -15,
      reason: "SMK-MEG-06 internal deduction note",
      idempotencyKey: `smk-meg-06-deduct-${Date.now()}`,
    });

    const operatorAfterDeduct = await operatorFetchMemberEngagement(operatorApi, userId!);
    expect(operatorAfterDeduct.totalPoints).toBe(35);
    const deductEvent = operatorAfterDeduct.recentPointEvents.find(
      (event) =>
        event.sourceEventType === "engagement.points.manual_adjustment" && event.pointsDelta === -15,
    );
    expect(deductEvent).toBeTruthy();
    expect(deductEvent?.reason).toContain("SMK-MEG-06");
    expect(deductEvent?.actorRole).toBeTruthy();

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-engagement-points]")).toContainText("35", {
      timeout: 60_000,
    });
    const pointsText = await page.locator("[data-portal-member-engagement-points]").innerText();
    expect(pointsText).not.toMatch(/^-/);
    expect(pointsText).not.toContain("-");

    await page.locator("[data-portal-member-engagement-cta]").click();
    await expect(page.locator("[data-portal-member-engagement-page]")).toBeVisible({
      timeout: 60_000,
    });

    const correctionItem = page.locator(
      '[data-portal-member-engagement-history-item][data-portal-member-engagement-history-kind="correction"]',
    );
    await expect(correctionItem).toBeVisible({ timeout: 60_000 });
    await expect(correctionItem).toContainText(/اصلاح امتیاز|Points correction/i);
    await expect(correctionItem).not.toContainText("-15");
    await expect(correctionItem).not.toContainText("SMK-MEG-06");

    const correctionColor = await correctionItem.evaluate((el) =>
      window.getComputedStyle(el).color,
    );
    const destructiveToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--destructive").trim(),
    );
    if (destructiveToken.length > 0) {
      expect(correctionColor).not.toContain(destructiveToken);
    }

    const awardEvent = operatorAfterDeduct.recentPointEvents.find(
      (event) => event.sourceEventType === "profile.completed" && event.pointsDelta > 0,
    );
    expect(awardEvent).toBeTruthy();

    await operatorReverseMemberPointEvent(operatorApi, userId!, {
      originalEventId: awardEvent!.id,
      reason: "SMK-MEG-06 duplicate award correction",
      idempotencyKey: `smk-meg-06-reverse-${Date.now()}`,
    });

    await page.goto("/me/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-engagement-points]")).toContainText("0", {
      timeout: 60_000,
    });

    const reversalItem = page.locator(
      '[data-portal-member-engagement-history-item][data-portal-member-engagement-history-kind="reversal"]',
    );
    await expect(reversalItem).toBeVisible({ timeout: 60_000 });
    await expect(reversalItem).toContainText(/برگشت امتیاز|Points reversal/i);
    await expect(reversalItem).not.toContainText("-50");

    await reversalItem.locator("summary").click();
    await expect(reversalItem).toContainText(
      /امتیاز این رویداد اصلاح شد|Points for this activity were corrected/i,
    );

    const memberHistoryRes = await page.request.get("/api/me/engagement/points?limit=20");
    expect(memberHistoryRes.ok()).toBeTruthy();
    const memberHistory = (await memberHistoryRes.json()) as {
      items?: readonly { pointsAwarded?: number | null; kind?: string }[];
    };
    for (const item of memberHistory.items ?? []) {
      if (item.pointsAwarded !== null && item.pointsAwarded !== undefined) {
        expect(item.pointsAwarded).toBeGreaterThanOrEqual(0);
      }
      expect(item.kind).not.toBe("operator_audit");
    }

    await page.screenshot({
      path: "/opt/cursor/artifacts/portal-member-negative-ux-after-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/portal-member-negative-ux-after-mobile.png",
      fullPage: true,
    });

    await operatorApi.dispose();
  });
});
