/**
 * Phase 3 — Journey F finance confidence (browser slice F01-A).
 *
 * Proves operator ledger panel visibility for Denali tenant.
 * Does NOT claim Create-tour → TourCreated ledger (host TourCreated is tourId-only;
 * finance Path B needs registrationId + paidAmountMinor — see TEMP design).
 *
 * @see TEMP/DENALI_PHASE_3_WAVE2_FINANCE_E2E_DESIGN.md
 * @see TEMP/DENALI_PHASE_3_JOURNEY_INVENTORY.md (P3-E2E-F01)
 */
import { expect, test } from "@playwright/test";

import { FINANCE_LEDGER_TEST_IDS } from "../../src/finance/finance-reports-logic";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";

test.describe("denali-finance-confidence.spec.ts — Phase 3 F01-A", () => {
  test("P3-E2E-F01-A01 owner opens finance ledger tab (panel loads)", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/finance?tab=ledger", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("finance-command-center")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(FINANCE_LEDGER_TEST_IDS.panel)).toBeVisible({
      timeout: 20_000,
    });
    // Fetch settled: list, empty landmark, or error alert — not stuck on skeletons only.
    await expect(
      page
        .getByTestId(FINANCE_LEDGER_TEST_IDS.list)
        .or(page.getByTestId(FINANCE_LEDGER_TEST_IDS.emptyState))
        .or(page.getByTestId(FINANCE_LEDGER_TEST_IDS.panel).getByRole("alert"))
    ).toBeVisible({ timeout: 20_000 });
  });

  test("P3-E2E-F01-A02 ledger export control is wired", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/finance?tab=ledger", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(FINANCE_LEDGER_TEST_IDS.panel)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(FINANCE_LEDGER_TEST_IDS.exportCsv)).toBeVisible({
      timeout: 15_000,
    });
  });
});
