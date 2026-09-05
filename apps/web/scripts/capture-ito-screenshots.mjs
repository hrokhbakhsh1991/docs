/**
 * FDA audit — capture ITO operations UI screenshots (BFF login).
 */
import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { resolveOperatorSmokeOwnerMobile } from "./operator-smoke-identity.mjs";

const SESSION_TOKEN_COOKIE = "atour_op_session";

const TOUR_ID = "00000000-0000-4000-8000-000000000220";
const OUT_DIR = process.argv[2] ?? "/opt/cursor/artifacts/ito-ui-audit-after";
const BASE = "http://admin.denali.localhost:3000";
const OWNER_MOBILE = resolveOperatorSmokeOwnerMobile();
const DEV_OTP = process.env.OPERATOR_DEV_OTP?.trim() || "1234";

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900, locale: "en" },
  { name: "desktop-1280x800", width: 1280, height: 800, locale: "en" },
  { name: "mobile-390x844-en", width: 390, height: 844, locale: "en" },
  { name: "mobile-360x800-fa", width: 360, height: 800, locale: "fa" },
];

mkdirSync(OUT_DIR, { recursive: true });

async function loginViaBff(page) {
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: OWNER_MOBILE },
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = await otpRes.json();

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: OWNER_MOBILE,
      otp: DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
  });
  expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
  const loginBody = await loginRes.json();
  expect(typeof loginBody.session_token).toBe("string");
  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function captureOperations(page, tag) {
  await page.goto(`${BASE}/tours/${encodeURIComponent(TOUR_ID)}/workspace?tab=operations`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByTestId("operator-tour-workspace-operations-panel")
    .waitFor({ state: "visible", timeout: 120_000 });
  await page.getByTestId("ito-execution-state").waitFor({ state: "visible", timeout: 120_000 });
  await page
    .getByTestId("ito-manifest-table")
    .or(page.getByTestId("ito-manifest-list"))
    .or(page.getByTestId("ito-manifest-empty"))
    .waitFor({ state: "visible", timeout: 120_000 });
  await page.screenshot({
    path: path.join(OUT_DIR, `${tag}-operations.png`),
    fullPage: true,
  });
}

const browser = await chromium.launch({ headless: true });
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: vp.width, height: vp.height },
    locale: vp.locale === "fa" ? "fa-IR" : "en-US",
  });
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: vp.locale,
      domain: "admin.denali.localhost",
      path: "/",
    },
  ]);
  const page = await context.newPage();
  await loginViaBff(page);
  await captureOperations(page, vp.name);
  await context.close();
}
await browser.close();
console.log(`Captured screenshots in ${OUT_DIR}`);
