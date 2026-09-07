/**
 * Operator ticketing inbox UI helpers for cross-surface TKT-BQC tests.
 * Requires @apps/web on operator.localhost:3000 (see smoke-portal-ticketing-e2e-servers.mjs).
 */
import { expect, type Browser, type Page } from "@playwright/test";

import { OPERATOR_TICKETS_TEST_IDS } from "../../../../web/src/features/tickets/operator-tickets-types";
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

async function openOperatorTicketsInbox(page: Page): Promise<void> {
  await page.goto("/tickets", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.shell)).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator("[data-operator-tickets][data-operator-tickets-ready='true']")).toBeVisible({
    timeout: 90_000,
  });
}

async function selectOpenTicketBySubject(
  page: Page,
  input: { readonly ticketId: string; readonly subject: string },
): Promise<void> {
  const row = page
    .locator(`[data-testid="${OPERATOR_TICKETS_TEST_IDS.inboxRow}"][data-ticket-id="${input.ticketId}"]`)
    .filter({ hasText: input.subject })
    .first();
  await expect(row).toBeVisible({ timeout: 60_000 });

  const detailResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/api/tickets/${input.ticketId}`) &&
      response.ok(),
    { timeout: 60_000 },
  );
  await row.getByRole("button").click();
  await detailResponse;

  const detailPanel = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.detail).filter({ visible: true }).first();
  await expect(detailPanel).toHaveAttribute("data-operator-tickets-detail-state", "ready");
  await expect(detailPanel.locator("h2")).toContainText(input.subject);
  await expect(
    detailPanel.locator("[data-operator-status-badge]").filter({ hasText: /باز|Open/i }),
  ).toBeVisible();
}

export async function withOperatorTicketingUi(
  browser: Browser,
  run: (operatorPage: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({
    baseURL: OPERATOR_WEB_BASE_URL,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    await loginOperatorOwner(page);
    await openOperatorTicketsInbox(page);
    await run(page);
  } finally {
    await context.close();
  }
}

export async function operatorResolveTicketViaUi(
  operatorPage: Page,
  input: { readonly ticketId: string; readonly subject: string },
): Promise<void> {
  await selectOpenTicketBySubject(operatorPage, input);

  const detailPanel = operatorPage
    .getByTestId(OPERATOR_TICKETS_TEST_IDS.detail)
    .filter({ visible: true })
    .first();
  const resolveResponse = operatorPage.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes(`/api/tickets/${input.ticketId}`) &&
      response.ok(),
    { timeout: 60_000 },
  );
  await detailPanel.getByRole("button", { name: /حل‌شده|Resolve/i }).click();
  await operatorPage.getByTestId("operator-tickets-resolve-confirm-confirm").click();
  await resolveResponse;

  await expect(
    detailPanel.locator("[data-operator-status-badge]").filter({ hasText: /حل‌شده|Resolved/i }),
  ).toBeVisible({ timeout: 60_000 });
}
