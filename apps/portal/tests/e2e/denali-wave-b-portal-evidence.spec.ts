/**
 * Denali Wave B — portal browser evidence (DP-1 deadline, DP-4 cancel, DP-6 refund UI).
 * Requires dev surfaces + `scripts/denali-wave-b-browser-evidence.sh` seed.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const MEMBER_PHONE = process.env.SMOKE_MEMBER_PHONE?.trim() || "+15550001003";
const EVIDENCE_ROOT =
  process.env.WAVE_B_EVIDENCE_DIR?.trim() ||
  join(process.cwd(), "../../docs/evidence/denali-wave-b/browser-pending");
const BROWSER_DIR = join(EVIDENCE_ROOT, "browser");

function ensureBrowserDir(): void {
  if (!existsSync(BROWSER_DIR)) {
    mkdirSync(BROWSER_DIR, { recursive: true });
  }
}

async function loginMember(page: import("@playwright/test").Page): Promise<void> {
  await page.context().clearCookies();
  const otpRes = await page.request.post("/api/public-auth/request-otp", {
    data: { phone: MEMBER_PHONE },
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const verifyRes = await page.request.post("/api/public-auth/verify-otp", {
    data: {
      phone: MEMBER_PHONE,
      otp: "1234",
      challenge_id: otpBody.challenge_id,
    },
  });
  const verifyText = await verifyRes.text();
  expect(verifyRes.ok(), verifyText).toBeTruthy();
  const verifyBody = JSON.parse(verifyText) as { session_token?: string };
  expect(typeof verifyBody.session_token).toBe("string");

  const cookieDomain = "portal.operator.localhost";
  await page.context().addCookies([
    {
      name: "atour_mb_session",
      value: verifyBody.session_token!,
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const listRes = await page.request.get("/api/me/registrations");
  expect(listRes.ok(), await listRes.text()).toBeTruthy();

  await page.goto("/me/registrations", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 120_000,
  });
}

async function openRegistrationDetail(
  page: import("@playwright/test").Page,
  registrationId: string
): Promise<void> {
  const detailLink = page.locator(
    `[data-portal-member-registrations-list] a[href*="/me/registrations/${registrationId}"]`
  );
  await expect(detailLink.first()).toBeVisible({ timeout: 120_000 });
  await detailLink.first().click();
  await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("Denali Wave B portal browser evidence", () => {
  test.beforeAll(() => {
    ensureBrowserDir();
  });

  test("DP-4 portal registrations desktop + mobile", async ({ page }) => {
    await loginMember(page);
    await page.screenshot({
      path: join(BROWSER_DIR, "dp4-registrations-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp4-registrations-390.png"),
      fullPage: true,
    });
  });

  test("DP-1 deadline + DP-4 cancel panel on member detail", async ({ page }) => {
    const regId = process.env.WAVE_B_BROWSER_REG_ID?.trim();
    expect(regId, "WAVE_B_BROWSER_REG_ID required from seed script").toBeTruthy();

    await loginMember(page);
    await openRegistrationDetail(page, regId!);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp1-member-deadline-1440.png"),
      fullPage: true,
    });

    const cancelPanel = page.locator("[data-portal-member-cancel]");
    await expect(cancelPanel).toBeVisible({ timeout: 60_000 });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp4-member-detail-cancel-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp4-member-detail-cancel-390.png"),
      fullPage: true,
    });
  });

  test("DP-6 portal refund state when seeded", async ({ page }) => {
    const refundRegId = process.env.WAVE_B_BROWSER_REFUND_REG_ID?.trim();
    if (!refundRegId) {
      test.skip();
      return;
    }

    await loginMember(page);
    await openRegistrationDetail(page, refundRegId);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp6-member-refund-1440.png"),
      fullPage: true,
    });
  });
});
