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
import { resolveChainSmokePublishedTourId } from "../../test/fixtures/p6-chain-guest-api";

function workspaceFinancePath(focusRegistrationId?: string): string {
  const base = `/tours/${resolveChainSmokePublishedTourId()}/workspace?tab=finance`;
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
    const rollup = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.rollup);
    const settled = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.allSettled);
    await expect(rollup.or(settled)).toBeAttached({ timeout: 20_000 });

    const controls = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.controls);
    const search = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.search);
    await expect(controls.or(settled)).toBeVisible({ timeout: 20_000 });
    await expect(search.or(settled)).toBeVisible({ timeout: 20_000 });

    const guestList = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList);
    const empty = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.empty);
    await expect(guestList.or(settled).or(empty)).toBeVisible({ timeout: 20_000 });
    await expect(
      page
        .getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel)
        .or(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailEmpty))
        .or(settled)
    ).toBeVisible({ timeout: 20_000 });

    // Hub escape lives in compact rollup footer when actionable finance rows exist.
    const openHub = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.openHub);
    await expect(openHub.or(settled)).toBeAttached({ timeout: 20_000 });
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
