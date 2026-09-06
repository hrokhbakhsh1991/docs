import { expect, test } from "@playwright/test";

import { DENALI_SMOKE_PUBLISHED_TOUR_ID } from "./fixtures/complete-portal-registration";

test.use({ baseURL: "http://portal.denali.localhost:3003" });

test("DEN-PROF-SSR-01 profile SSR renders member fields with Domain cookie", async ({
  page,
  context,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const portalOrigin = "http://portal.denali.localhost:3003";
  const internal = "http://127.0.0.1:3003";

  const requestOtp = await page.request.post(`${internal}/api/public-auth/request-otp`, {
    data: { phone },
    headers: { host: "portal.denali.localhost:3003" },
  });
  expect(requestOtp.ok()).toBeTruthy();
  const { challenge_id } = (await requestOtp.json()) as { challenge_id: string };

  const verifyOtp = await page.request.post(`${internal}/api/public-auth/verify-otp`, {
    data: { phone, otp: "1234", challenge_id },
    headers: { host: "portal.denali.localhost:3003" },
  });
  expect(verifyOtp.ok()).toBeTruthy();
  const verifyBody = (await verifyOtp.json()) as { onboarding_token?: string };
  expect(verifyBody.onboarding_token).toBeTruthy();

  const registerComplete = await page.request.post(`${internal}/api/public-auth/register-complete`, {
    data: {
      onboarding_token: verifyBody.onboarding_token,
      display_name: "SSR Profile Fix",
      email: `ssr-fix-${Date.now()}@denali.local`,
    },
    headers: { host: "portal.denali.localhost:3003" },
  });
  expect(registerComplete.ok()).toBeTruthy();
  const registerBody = (await registerComplete.json()) as { session_token?: string };
  expect(registerBody.session_token).toBeTruthy();

  await context.addCookies([
    {
      name: "atour_mb_session",
      value: registerBody.session_token!,
      domain: ".denali.localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const profileProbe = await page.request.get(`${portalOrigin}/api/me/profile`);
  expect(profileProbe.ok(), `profile probe failed (${profileProbe.status()})`).toBeTruthy();

  await page.goto(`${portalOrigin}/me/profile`, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator("main[data-portal-member-profile]")).toBeVisible();
  await expect(page.locator('[data-member-profile-field="displayName"] input')).toHaveValue(
    "SSR Profile Fix"
  );
  await expect(page.locator('main[data-portal-member-profile] [role="alert"]')).toHaveCount(0);

  await page.goto(`${portalOrigin}/catalog/${DENALI_SMOKE_PUBLISHED_TOUR_ID}/register`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('[data-registration-resume="intake"]').first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-register-auth-gate]")).toHaveCount(0);
});
