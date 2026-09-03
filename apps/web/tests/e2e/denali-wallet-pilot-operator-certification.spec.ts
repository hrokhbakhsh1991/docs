/**
 * Phase 2 — Denali Wallet pilot operator certification (Postgres E2E).
 */
import { expect, test } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../api/test/fixtures/denali-wallet-pilot-tenant";
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
  await expect(page.locator('[data-operator-nav-link][href="/wallet"]')).toBeVisible({
    timeout: 60_000,
  });
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
});

test("WALLET-PILOT-O02 account search, IRR balance, and history", async ({ page }) => {
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
    .fill(DENALI_WALLET_PILOT.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
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
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
    .fill(DENALI_WALLET_PILOT.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.creditButton).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("5000");
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.mutationReason)
    .fill("refundId: pilot-manual-refund-001");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationFeedback)).toBeVisible({
    timeout: 60_000,
  });
});

test("WALLET-PILOT-O04 insufficient debit rejected", async ({ page }) => {
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
    .fill(DENALI_WALLET_PILOT.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.debitButton).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("999999999");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationReason).fill("pilot insufficient test");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog).getByRole("alert")).toBeVisible(
    { timeout: 60_000 }
  );
});
