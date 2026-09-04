/**
 * WALLET-A11Y — Denali operator wallet accessibility (axe + keyboard + forms).
 */
import { expect, test, devices } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../api/test/fixtures/denali-wallet-pilot-tenant";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { WALLET_OPS_TEST_IDS } from "../../src/wallet/wallet-ops-logic";
import {
  assertDialogFocusManagement,
  assertFormLabelsPresent,
  assertKeyboardReachable,
  assertNoSeriousA11yViolations,
} from "./fixtures/wallet-a11y-helpers";
import {
  DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH,
  loginDenaliWalletPilotOwner,
} from "./fixtures/denali-wallet-pilot-owner-session";

async function openPilotAccount(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
  await page
    .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
    .fill(DENALI_WALLET_PILOT.entitledMemberUserId);
  await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
  await expect(page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first()).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
}

test.describe("WALLET-A11Y operator wallet", () => {
  test.setTimeout(300_000);

  test("WALLET-A11Y-O01 operator wallet overview and empty search", async ({ page }) => {
    await loginDenaliWalletPilotOwner(page);
    await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
    await assertNoSeriousA11yViolations(page, "[data-wallet-ops]", "operator wallet overview");
    await assertKeyboardReachable(page, page.getByTestId(WALLET_OPS_TEST_IDS.searchInput));
    await page
      .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
      .fill("00000000-0000-4000-8000-000099999999");
    await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.empty)).toBeVisible({ timeout: 60_000 });
    await assertNoSeriousA11yViolations(page, "[data-wallet-ops]", "operator wallet empty state");
  });

  test("WALLET-A11Y-O02 member lookup result balance and history", async ({ page }) => {
    await loginDenaliWalletPilotOwner(page);
    await openPilotAccount(page);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.balanceAmount)).toContainText(/ریال|IRR/);
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.historyRow).first()).toBeVisible({
      timeout: 60_000,
    });
    const historyRow = page.getByTestId(WALLET_OPS_TEST_IDS.historyRow).first();
    const rowText = await historyRow.innerText();
    expect(rowText).toMatch(/credit|debit|reversal|ریال|IRR/i);
    await assertNoSeriousA11yViolations(page, "[data-wallet-ops]", "operator wallet account detail");
  });

  test("WALLET-A11Y-O03 credit mutation dialog labels and focus", async ({ page }) => {
    await loginDenaliWalletPilotOwner(page);
    await openPilotAccount(page);
    await page.getByTestId(WALLET_OPS_TEST_IDS.creditButton).click();
    const dialog = page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog);
    await expect(dialog).toBeVisible();
    await assertFormLabelsPresent(dialog);
    await assertDialogFocusManagement(page, WALLET_OPS_TEST_IDS.mutationDialog);
    await assertNoSeriousA11yViolations(
      page,
      `[data-testid="${WALLET_OPS_TEST_IDS.mutationDialog}"]`,
      "operator wallet credit dialog",
    );
    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationCancel).click();
    await expect(dialog).toBeHidden();
  });

  test("WALLET-A11Y-O04 insufficient debit surfaces alert status", async ({ page }) => {
    await loginDenaliWalletPilotOwner(page);
    await openPilotAccount(page);
    await page.getByTestId(WALLET_OPS_TEST_IDS.debitButton).click();
    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("999999999");
    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationReason).fill("wallet a11y insufficient");
    await page.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
    const alert = page.getByTestId(WALLET_OPS_TEST_IDS.mutationDialog).getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 60_000 });
    await assertNoSeriousA11yViolations(
      page,
      `[data-testid="${WALLET_OPS_TEST_IDS.mutationDialog}"]`,
      "operator wallet debit error dialog",
    );
  });

  test("WALLET-A11Y-O05 wallet-disabled tenant denies /wallet route", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: "http://admin.operator.localhost:3000",
    });
    const page = await context.newPage();
    try {
      await loginOperatorOwner(page);
      const response = await page.goto("/wallet", { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  test("WALLET-A11Y-O06 operator wallet loading state (mobile RTL)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/wallet/accounts?**", async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_500));
      await route.continue();
    });
    await loginDenaliWalletPilotOwner(page);
    await page.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
    await page
      .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
      .fill(DENALI_WALLET_PILOT.entitledMemberUserId);
    await page.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
    await expect(page.getByTestId(WALLET_OPS_TEST_IDS.loading).first()).toBeVisible({
      timeout: 30_000,
    });
    await assertNoSeriousA11yViolations(page, "[data-wallet-ops]", "operator wallet loading mobile");
  });
});
