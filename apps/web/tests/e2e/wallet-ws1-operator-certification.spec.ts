/**
 * WALLET-P3C — operator wallet ops certification (Postgres E2E).
 */
import { expect, test } from "@playwright/test";

import { WALLET_WS1_CERTIFICATION } from "../../../api/test/fixtures/wallet-ws1-certification-tenant";
import { WALLET_OPS_TEST_IDS } from "../../src/wallet/wallet-ops-logic";
import {
  WALLET_WS1_OPERATOR_WALLET_PATH,
  loginWalletWs1Owner,
} from "./fixtures/wallet-ws1-owner-session";

test.beforeEach(async ({ page }) => {
  await loginWalletWs1Owner(page);
});

test("WALLET-CERT-O01 operator wallet nav and page load", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-operator-nav-link][href="/wallet"]')).toBeVisible({
    timeout: 60_000,
  });
  await page.goto(WALLET_WS1_OPERATOR_WALLET_PATH);
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
});

test("WALLET-CERT-O02 account search, balance, and history", async ({ page }) => {
  await page.goto(WALLET_WS1_OPERATOR_WALLET_PATH);
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
    .fill(WALLET_WS1_CERTIFICATION.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first()).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.balanceAmount)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.historyRow).first()).toBeVisible({
    timeout: 60_000,
  });
});

test("WALLET-CERT-O03 manual credit requires reason and confirmation", async ({ page }) => {
  await page.goto(WALLET_WS1_OPERATOR_WALLET_PATH);
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
    .fill(WALLET_WS1_CERTIFICATION.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.creditButton).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog)).toBeVisible();
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
  await expect(
    page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog).getByRole("alert")
  ).toBeVisible();
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("100");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationReason).fill("certification credit");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationFeedback)).toBeVisible({
    timeout: 60_000,
  });
});

test("WALLET-CERT-O04 insufficient funds debit shows error without corrupting balance", async ({
  page,
}) => {
  await page.goto(WALLET_WS1_OPERATOR_WALLET_PATH);
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
    .fill(WALLET_WS1_CERTIFICATION.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
  const before = await page.getByTestId(WALLET_OPS_TEST_IDS.balanceAmount).textContent();
  await page.getByTestId(WALLET_OPS_TEST_IDS.debitButton).click();
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("99999900");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationReason).fill("certification insufficient");
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog).getByRole("alert")).toBeVisible(
    {
      timeout: 60_000,
    }
  );
  await page.getByTestId(WALLET_OPS_TEST_IDS.mutationCancel).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.balanceAmount)).toHaveText(before ?? "");
});

test("WALLET-CERT-O05 idempotent credit replay returns safely", async ({ page }) => {
  await page.goto(WALLET_WS1_OPERATOR_WALLET_PATH);
  const searchRes = await page.request.get(
    `/api/wallet/accounts?userId=${encodeURIComponent(WALLET_WS1_CERTIFICATION.entitledMemberUserId)}`
  );
  expect(searchRes.ok()).toBeTruthy();
  const searchJson = (await searchRes.json()) as { items?: Array<{ id: string }> };
  const accountId = searchJson.items?.[0]?.id;
  expect(accountId).toBeTruthy();

  const idempotencyKey = `wallet-cert-replay-${Date.now()}`;
  const payload = { amountMinor: "100", currency: "USD", reasonNote: "replay test" };
  const first = await page.request.post(`/api/wallet/accounts/${accountId}/credit`, {
    headers: { "Idempotency-Key": idempotencyKey },
    data: payload,
  });
  expect(first.ok()).toBeTruthy();
  const second = await page.request.post(`/api/wallet/accounts/${accountId}/credit`, {
    headers: { "Idempotency-Key": idempotencyKey },
    data: payload,
  });
  expect(second.ok()).toBeTruthy();
  const firstJson = await first.json();
  const secondJson = await second.json();
  expect(firstJson.transaction?.id).toBe(secondJson.transaction?.id);
});
