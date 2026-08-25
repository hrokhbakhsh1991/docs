/**
 * Wave B.5 — DP-6 authenticated portal refund closure.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const MEMBER_PHONE = process.env.SMOKE_MEMBER_PHONE?.trim() || "+15550001003";
const EVIDENCE_ROOT =
  process.env.WAVE_B_EVIDENCE_DIR?.trim() ||
  join(process.cwd(), "../../docs/evidence/denali-wave-b5/pending");
const BROWSER_DIR = join(EVIDENCE_ROOT, "browser");
const API_DIR = join(EVIDENCE_ROOT, "api");

async function loginMember(page: import("@playwright/test").Page): Promise<void> {
  await page.context().clearCookies();
  const otpRes = await page.request.post("/api/public-auth/request-otp", {
    data: { phone: MEMBER_PHONE },
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
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
  await page.context().addCookies([
    {
      name: "atour_mb_session",
      value: verifyBody.session_token!,
      domain: "portal.operator.localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test.describe("Wave B.5 DP-6 portal refund evidence", () => {
  test("authenticated member sees cancelled paid registration + refund BFF", async ({
    page,
  }) => {
    const regId = process.env.WAVE_B5_REFUND_REG_ID?.trim();
    expect(regId, "WAVE_B5_REFUND_REG_ID from seed script").toBeTruthy();

    if (!existsSync(BROWSER_DIR)) mkdirSync(BROWSER_DIR, { recursive: true });
    if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });

    await loginMember(page);

    const detailRes = await page.request.get(
      `/api/me/registrations/${encodeURIComponent(regId!)}`
    );
    const detailText = await detailRes.text();
    writeFileSync(join(API_DIR, "dp6-member-detail.json"), detailText);
    expect(detailRes.ok(), detailText).toBeTruthy();

    const cancelRes = await page.request.get(
      `/api/me/registrations/${encodeURIComponent(regId!)}/cancellation`
    );
    const cancelText = await cancelRes.text();
    writeFileSync(join(API_DIR, "dp6-member-cancellation-bff.json"), cancelText);

    await page.goto(`/me/registrations/${encodeURIComponent(regId!)}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.locator("[data-portal-member-registration-status]")).toContainText(
      /cancel|لغو|cancelled/i,
      { timeout: 60_000 }
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp6-member-refund-1440.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp6-member-refund-390.png"),
      fullPage: true,
    });
  });
});
