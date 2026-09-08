/**
 * Manual QA — Scenario 1: approve unpaid → notice → finance focus.
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  clickWorkspaceApproveAndWait,
  ensureTourHasApprovalCapacity,
  escapeRegExp,
  openWorkspaceGuestRow,
  seedPendingUnpaidGuest,
  WORKSPACE_SMOKE_TOUR_ID,
} from "./fixtures/tour-workspace-smoke";

test.describe("scenario-1 approve unpaid → finance focus", () => {
  test("approve pending unpaid shows finance link and focuses guest on Money Inbox", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });

    const stamp = Date.now();
    const { guestName, registrationId } = await seedPendingUnpaidGuest(page, stamp);

    await page.goto(`/tours/${WORKSPACE_SMOKE_TOUR_ID}/workspace`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page
        .getByTestId(TOUR_WORKSPACE_TEST_IDS.registrationsPanel)
        .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)
    ).toBeVisible({
      timeout: 90_000,
    });

    await openWorkspaceGuestRow(page, guestName);
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toBeVisible({
      timeout: 20_000,
    });
    await clickWorkspaceApproveAndWait(page, registrationId);

    const notice = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice);
    await expect(notice).toBeVisible({ timeout: 20_000 });
    await expect(notice).toContainText(new RegExp(escapeRegExp(guestName), "i"));
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeTransportLink)
    ).toBeVisible();

    const financeLink = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeFinanceLink);
    await expect(financeLink).toBeVisible({ timeout: 10_000 });
    await financeLink.click();

    await expect(page).toHaveURL(/tab=finance/, { timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`focusRegistrationId=${registrationId}`), {
      timeout: 10_000,
    });

    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible({
      timeout: 30_000,
    });

    const focusMiss = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.focusMiss);
    const highlightedRow = page.locator(`[data-finance-registration-id="${registrationId}"]`);
    await expect(highlightedRow.or(focusMiss)).toBeVisible({ timeout: 30_000 });

    if ((await focusMiss.count()) === 0) {
      await expect(highlightedRow).toHaveClass(/ring/);
      await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel)).toBeVisible({
        timeout: 10_000,
      });
    }

    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.openHub)).toBeAttached();
  });
});
