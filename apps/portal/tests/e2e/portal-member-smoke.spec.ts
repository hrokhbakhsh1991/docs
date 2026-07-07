import { expect, test } from "@playwright/test";

import {
  OPERATOR_PUBLISHED_TOUR_TITLE,
  completePortalCatalogRegistration,
} from "./fixtures/complete-portal-registration";

const REGISTRATION_EMAIL = `smk-ptl-02-${Date.now()}@denali-smoke.local`;
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-PTL-02 member /me lists registration after catalog intake (VS-04)", async ({
  page,
}) => {
  await completePortalCatalogRegistration(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Portal Member Smoke",
    phone: DEV_PHONE,
  });

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.getByRole("link", { name: OPERATOR_PUBLISHED_TOUR_TITLE })).toBeVisible();
});

test("SMK-PTL-05 portal home redirects authenticated member to /me/registrations", async ({
  page,
}) => {
  const email = `smk-ptl-05-${Date.now()}@denali-smoke.local`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await completePortalCatalogRegistration(page, {
    email,
    fullName: "Portal Home Redirect Smoke",
    phone,
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 60_000 });
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });
});

const RECEIPT_EMAIL = `smk-ptl-04-${Date.now()}@denali-smoke.local`;
const RECEIPT_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-PTL-04 member uploads offline receipt on registration detail (VS-05)", async ({
  page,
}) => {
  await completePortalCatalogRegistration(page, {
    email: RECEIPT_EMAIL,
    fullName: "Portal Receipt Smoke",
    phone: RECEIPT_PHONE,
  });

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await page.getByRole("link", { name: OPERATOR_PUBLISHED_TOUR_TITLE }).first().click();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-member-receipt-submit]")).toBeVisible();
  await page.waitForLoadState("networkidle");

  const [uploadRes] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/me/registrations/") &&
        res.url().includes("/receipt") &&
        res.request().method() === "POST"
    ),
    (async () => {
      await page.locator("#receipt-file").setInputFiles({
        name: "proof.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("smoke-receipt-jpeg"),
      });
      await page.locator("[data-portal-member-receipt-submit]").first().click();
    })(),
  ]);
  const uploadBody = await uploadRes.text();
  expect(uploadRes.ok(), `receipt upload ${uploadRes.status()} ${uploadBody.slice(0, 300)}`).toBe(true);
  await expect(page.locator("[data-portal-member-receipt-success]")).toBeVisible({
    timeout: 60_000,
  });
});

test("SMK-PTL-06 member logout clears session and blocks /me area", async ({ page }) => {
  const email = `smk-ptl-06-${Date.now()}@denali-smoke.local`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await completePortalCatalogRegistration(page, {
    email,
    fullName: "Portal Logout Smoke",
    phone,
  });

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });
  const logoutButton = page.locator(
    '[data-public-auth-logout][data-public-auth-logout-ready="true"]'
  );
  await expect(logoutButton).toBeEnabled({ timeout: 60_000 });

  const [logoutResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/public-auth/logout"),
      { timeout: 60_000 }
    ),
    logoutButton.first().click(),
  ]);
  const logoutBody = await logoutResponse.text();
  expect(
    logoutResponse.ok(),
    `logout failed (${logoutResponse.status()}): ${logoutBody.slice(0, 240)}`
  ).toBeTruthy();

  await page.waitForURL((url) => !url.pathname.startsWith("/me"), { timeout: 60_000 });

  const sessionCookies = await page.context().cookies();
  expect(
    sessionCookies.some((cookie) => cookie.name === "atour_mb_session" && cookie.value.length > 0)
  ).toBe(false);

  const blockedMePage = await page.request.get("/me/registrations", { maxRedirects: 0 });
  expect(blockedMePage.status(), "middleware must redirect unauthenticated /me/*").toBe(307);
  expect(blockedMePage.headers().location).toBe("/");

  const blockedMeApi = await page.request.get("/api/me/registrations");
  expect(blockedMeApi.status(), "BFF must reject unauthenticated /api/me/*").toBe(401);
});

test("SMK-PTL-09 entitled modules appear in shell nav (PS-5)", async ({ page }) => {
  const email = `smk-ptl-09-${Date.now()}@denali-smoke.local`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await completePortalCatalogRegistration(page, {
    email,
    fullName: "Portal Entitlements Smoke",
    phone,
  });

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });

  const entitlementsResponse = await page.request.get("/api/me/entitlements");
  expect(entitlementsResponse.ok(), "entitlements BFF must succeed for session").toBeTruthy();
  const entitlementsBody = (await entitlementsResponse.json()) as { granted?: string[] };
  expect(entitlementsBody.granted).toContain("member.module.home");
  expect(entitlementsBody.granted).toContain("member.module.trips");

  await expect(page.getByTestId("portal-shell-nav-home")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("portal-shell-nav-trips")).toBeVisible();
});
