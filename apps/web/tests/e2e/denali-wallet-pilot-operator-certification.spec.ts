/**
 * Phase 2 — Denali Wallet pilot operator certification (Postgres E2E).
 */
import { expect, test } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../api/test/fixtures/denali-wallet-pilot-tenant";
import { OPERATOR_WELCOME_TEST_IDS } from "../../src/admin/onboarding/operator-welcome-types";
import { WALLET_OPS_TEST_IDS } from "../../src/wallet/wallet-ops-logic";
import {
  DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH,
  loginDenaliWalletPilotOwner,
} from "./fixtures/denali-wallet-pilot-owner-session";

test.beforeEach(async ({ page }) => {
  await loginDenaliWalletPilotOwner(page);
});

test("WALLET-PILOT-O01 operator wallet nav and page load", async ({ page }) => {
  await page.goto("/");
  const welcomeDialog = page.getByTestId(OPERATOR_WELCOME_TEST_IDS.dialog);
  if (await welcomeDialog.isVisible().catch(() => false)) {
    await page.getByTestId(OPERATOR_WELCOME_TEST_IDS.dismissCta).click();
  }
  await expect(page.locator('[data-operator-nav-link][href="/wallet"]')).toBeVisible({
    timeout: 60_000,
  });
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
});

test("WALLET-PILOT-O02 account search, IRR balance, and history", async ({ page }) => {
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  const searchInput = page.getByTestId(WALLET_OPS_TEST_IDS.searchInput);
  await expect(searchInput).toBeEnabled({ timeout: 60_000 });
  await searchInput.fill(DENALI_WALLET_PILOT.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.memberRow)
    .filter({ hasText: DENALI_WALLET_PILOT.entitledMemberMobile })
    .click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first()).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.balanceAmount)).toContainText(/ریال|IRR/);
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.historyRow).first()).toBeVisible({
    timeout: 60_000,
  });
});

test("WALLET-PILOT-O03 manual credit with refundId reference", async ({ page }) => {
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  const searchInput = page.getByTestId(WALLET_OPS_TEST_IDS.searchInput);
  await expect(searchInput).toBeEnabled({ timeout: 60_000 });
  await searchInput.fill(DENALI_WALLET_PILOT.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.memberRow)
    .filter({ hasText: DENALI_WALLET_PILOT.entitledMemberMobile })
    .click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.creditButton).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("5000");
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.mutationReason)
    .fill("refundId: pilot-manual-refund-001");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationFeedback)).toBeVisible({
    timeout: 180_000,
  });
});

test("WALLET-PILOT-O04 insufficient debit rejected", async ({ page }) => {
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  const searchInput = page.getByTestId(WALLET_OPS_TEST_IDS.searchInput);
  await expect(searchInput).toBeEnabled({ timeout: 60_000 });
  await searchInput.fill(DENALI_WALLET_PILOT.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.memberRow)
    .filter({ hasText: DENALI_WALLET_PILOT.entitledMemberMobile })
    .click();
  const accountRow = page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first();
  await expect(accountRow).toBeEnabled({ timeout: 60_000 });
  await accountRow.click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.debitButton).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("999999999");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationReason).fill("pilot insufficient test");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog).getByRole("alert")).toBeVisible(
    { timeout: 60_000 }
  );
});
