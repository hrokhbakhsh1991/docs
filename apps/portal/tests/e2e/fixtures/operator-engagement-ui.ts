/**
 * Operator engagement UI helpers for cross-surface MEG-BQC tests.
 * Requires @apps/web on operator.localhost:3000 (see smoke-portal-ticketing-e2e-servers.mjs).
 */
import { expect, type Browser, type Page } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../../../web/src/auth/build-session-cookie";

const OPERATOR_WEB_BASE_URL =
  process.env.SMOKE_OPERATOR_WEB_BASE_URL ?? "http://operator.localhost:3000";
const OPERATOR_OWNER_MOBILE = "09174070937";
const DEV_OTP = "1234";

async function loginOperatorOwner(page: Page): Promise<void> {
  await page.context().clearCookies();

  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: OPERATOR_OWNER_MOBILE },
    timeout: 120_000,
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: OPERATOR_OWNER_MOBILE,
      otp: DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  const loginText = await loginRes.text();
  expect(loginRes.ok(), loginText).toBeTruthy();
  const loginBody = JSON.parse(loginText) as { session_token?: string };
  expect(typeof loginBody.session_token).toBe("string");

  const cookieUrl = OPERATOR_WEB_BASE_URL.replace(/\/$/, "");
  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token!,
      url: cookieUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function withOperatorEngagementUi(
  browser: Browser,
  run: (operatorPage: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({
    baseURL: OPERATOR_WEB_BASE_URL,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  try {
    await loginOperatorOwner(page);
    await run(page);
  } finally {
    await context.close();
  }
}

export async function operatorOpenMemberEngagementByPhone(
  operatorPage: Page,
  phone: string,
): Promise<void> {
  await operatorPage.goto("/users", { waitUntil: "networkidle" });
  await expect(operatorPage.getByTestId("operator-users-page")).toBeVisible({ timeout: 60_000 });

  const memberRow = operatorPage
    .getByTestId("operator-users-table-desktop")
    .locator("tbody tr")
    .filter({ hasText: phone });
  const openDetails = memberRow.getByTestId("operator-users-row-details");
  await expect(openDetails).toBeVisible({ timeout: 60_000 });
  await openDetails.scrollIntoViewIfNeeded();
  await openDetails.click();

  await expect(operatorPage.getByTestId("operator-users-member-detail")).toBeVisible({
    timeout: 60_000,
  });
  await expect(operatorPage.getByTestId("operator-users-member-engagement")).toBeVisible({
    timeout: 60_000,
  });
  await expect(operatorPage.getByTestId("operator-engagement-member-lookup-result")).toBeVisible({
    timeout: 60_000,
  });
}

export async function operatorAdjustMemberPointsViaUi(
  operatorPage: Page,
  input: { readonly pointsDelta: number; readonly reason: string },
): Promise<void> {
  const pointsBefore = Number.parseInt(
    await operatorPage.getByTestId("operator-engagement-member-points").innerText(),
    10,
  );

  await operatorPage.getByTestId("operator-engagement-adjust-button").click();
  await expect(operatorPage.getByTestId("operator-engagement-adjust-dialog")).toBeVisible();
  await operatorPage.locator("#engagement-adjust-points").fill(String(input.pointsDelta));
  await operatorPage.locator("#engagement-adjust-reason").fill(input.reason);
  await operatorPage.getByRole("button", { name: /confirm|تأیید/i }).click();

  await expect(operatorPage.getByTestId("operator-engagement-member-points")).toContainText(
    String(pointsBefore + input.pointsDelta),
    { timeout: 60_000 },
  );
}

export async function operatorReverseFirstPointEventViaUi(
  operatorPage: Page,
  reason: string,
): Promise<void> {
  const pointsBefore = Number.parseInt(
    await operatorPage.getByTestId("operator-engagement-member-points").innerText(),
    10,
  );

  await operatorPage.getByTestId("operator-engagement-reverse-button").first().click();
  await expect(operatorPage.getByTestId("operator-engagement-reverse-dialog")).toBeVisible();
  await operatorPage.locator("#engagement-reverse-reason").fill(reason);
  await operatorPage.getByRole("button", { name: /confirm|تأیید/i }).click();

  await expect(operatorPage.getByTestId("operator-engagement-member-points")).not.toContainText(
    String(pointsBefore),
    { timeout: 60_000 },
  );
}
