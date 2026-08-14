/**
 * H-11 — Tour workspace Money Inbox smoke (?tab=finance).
 * Tour-scoped only — not Finance Hub product coverage.
 */
import { expect, test } from "@playwright/test";

import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import { OPERATOR_SMOKE_PUBLISHED_TOUR_ID } from "../../test/fixtures/p6-chain-guest-api";

function workspaceFinancePath(focusRegistrationId?: string): string {
  const base = `/tours/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}/workspace?tab=finance`;
  if (focusRegistrationId === undefined || focusRegistrationId.trim().length === 0) {
    return base;
  }
  return `${base}&focusRegistrationId=${encodeURIComponent(focusRegistrationId.trim())}`;
}

test.describe("denali-workspace-finance-inbox.spec.ts — H-11", () => {
  test("finance tab shows Money Inbox chrome (status/filters/guest list or settled)", async ({
    page,
  }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(workspaceFinancePath());

    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible();
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.rollup)).toBeVisible();

    const filters = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.filters);
    const settled = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.allSettled);
    await expect(filters.or(settled)).toBeVisible({ timeout: 20_000 });

    const guestList = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList);
    const empty = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.empty);
    await expect(guestList.or(settled).or(empty)).toBeVisible({ timeout: 20_000 });
    await expect(
      page
        .getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel)
        .or(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailEmpty))
        .or(settled)
    ).toBeVisible({ timeout: 20_000 });

    // Hub escape exists when panel loaded (footer always renders after load).
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.openHub)).toBeVisible();
  });

  test("finance focusRegistrationId miss shows fail-soft case link", async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(workspaceFinancePath("00000000-0000-4000-8000-00000000dead"));

    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.focusMiss)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.openCase)).toBeVisible();
  });
});
