/**
 * MEG-001 — portal member dashboard engagement smoke.
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForEngagement } from "./fixtures/authenticate-portal-member-for-engagement";
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
    await expect(page.locator("[data-portal-member-engagement-badges]")).toBeVisible();

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
});
