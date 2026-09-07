/**
 * BQC wallet state matrix — Denali admin operator wallet (W01..W06).
 */
import { expect, test, type Page } from "@playwright/test";

import { DENALI_DEFAULT_WALLET } from "@apps/api/test/fixtures/denali-default-wallet-tenant";
import { WALLET_OPS_TEST_IDS } from "../../src/wallet/wallet-ops-logic";
import {
  DENALI_DEV_OTP,
  DENALI_OPERATOR_OWNER_MOBILE,
  DENALI_OPERATOR_VIEWER_MOBILE,
} from "./fixtures/authenticate-denali-operator-for-engagement";
import { SESSION_TOKEN_COOKIE } from "../../src/auth/build-session-cookie";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://denali.admin.localhost:3000";
const WALLET_PATH = "/wallet";

async function captureWalletArtifact(page: Page, path: string): Promise<void> {
  try {
    await page.screenshot({ path, fullPage: true });
  } catch (error) {
    console.warn(`Wallet BQC artifact screenshot skipped (${path}):`, error);
  }
}

async function loginOperator(
  page: Page,
  phone: string,
  endpoint: "login-web-session" | "login-team-web-session" = "login-web-session",
): Promise<void> {
  await page.context().clearCookies();
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone },
    timeout: 120_000,
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post(`/api/auth/${endpoint}`, {
    data: {
      phone,
      otp: DENALI_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
  const loginBody = (await loginRes.json()) as { session_token?: string };
  expect(typeof loginBody.session_token).toBe("string");

  const cookieUrl = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
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

test.describe("BQC Denali wallet operator states", () => {
  test.beforeEach(async ({ page }) => {
    await loginOperator(page, DENALI_OPERATOR_OWNER_MOBILE);
  });

  test("W01 idle page load and nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-operator-nav-link][href="/wallet"]')).toBeVisible({
      timeout: 60_000,
    });
    await page.goto(WALLET_PATH);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.searchForm)).toBeVisible();
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-01-idle-page.png");
  });

  test("W02 invalid member UUID validation error", async ({ page }) => {
    await page.goto(WALLET_PATH);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
    await page.getByTestId(WALLET_OPS_TEST_IDS.searchInput).fill("not-a-uuid");
    await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.error)).toBeVisible({ timeout: 10_000 });
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-02-validation-error.png");
  });

  test("W03 valid UUID search — loading then result or API error", async ({ page }) => {
    await page.goto(WALLET_PATH);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
    await page
      .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
      .fill(DENALI_DEFAULT_WALLET.entitledMemberUserId);
    await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();

    const loading = page.getByTestId(WALLET_OPS_TEST_IDS.loading);
    const empty = page.getByTestId(WALLET_OPS_TEST_IDS.empty);
    const accountRow = page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first();
    const loadError = page.getByTestId(WALLET_OPS_TEST_IDS.error);

    await expect(loading.or(empty).or(accountRow).or(loadError)).toBeVisible({
      timeout: 60_000,
    });

    if (await loadError.isVisible()) {
      await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-03-api-error.png");
      throw new Error("wallet accounts API returned error state");
    }

    await expect(accountRow).toBeVisible({ timeout: 15_000 });
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-03-accounts-found.png");
    await accountRow.click();
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.balanceAmount)).toBeVisible({
      timeout: 60_000,
    });
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-04-account-selected.png");
  });

  test("W04 credit dialog validation and cancel", async ({ page }) => {
    await page.goto(WALLET_PATH);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
    await page
      .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
      .fill(DENALI_DEFAULT_WALLET.entitledMemberUserId);
    await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();

    const accountRow = page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first();
    await expect(accountRow).toBeVisible({ timeout: 60_000 });

    await accountRow.click();
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.creditButton)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId(WALLET_OPS_TEST_IDS.creditButton).click();
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog)).toBeVisible();
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-05-credit-dialog-open.png");

    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
    await expect(
      page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog).getByRole("alert"),
    ).toBeVisible({ timeout: 10_000 });
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-06-credit-validation-error.png");

    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationCancel).click();
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog)).not.toBeVisible();
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-07-credit-dialog-cancelled.png");
  });

  test("W05 insufficient debit rejected", async ({ page }) => {
    await page.goto(WALLET_PATH);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
    await page
      .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
      .fill(DENALI_DEFAULT_WALLET.entitledMemberUserId);
    await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();

    const accountRow = page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first();
    await expect(accountRow).toBeVisible({ timeout: 60_000 });

    await accountRow.click();
    await page.getByTestId(WALLET_OPS_TEST_IDS.debitButton).click();
    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("999999999");
    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationReason).fill("bqc insufficient funds test");
    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
    await expect(
      page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog).getByRole("alert"),
    ).toBeVisible({ timeout: 60_000 });
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-08-insufficient-debit.png");
  });
});

test.describe("BQC Denali wallet viewer forbidden", () => {
  test("W06 viewer is blocked from wallet page", async ({ page }) => {
    await loginOperator(page, DENALI_OPERATOR_VIEWER_MOBILE, "login-team-web-session");
    await page.goto(WALLET_PATH, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/access=owner-only|auth\/login/i);
    await captureWalletArtifact(page, "/opt/cursor/artifacts/wallet-09-viewer-forbidden.png");
  });
});
