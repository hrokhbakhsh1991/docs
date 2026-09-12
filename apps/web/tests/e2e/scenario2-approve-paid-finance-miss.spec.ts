/**
 * Manual QA — Scenario 2: approve without payment → no finance CTA;
 * focus miss when guest not in money queue → Open case.
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
  clickWorkspaceApproveWithoutPaymentAndWait,
  ensureTourHasApprovalCapacity,
  escapeRegExp,
  openWorkspaceGuestRow,
  seedPendingUnpaidGuest,
  WORKSPACE_SMOKE_TOUR_ID,
} from "./fixtures/tour-workspace-smoke";

test.describe("scenario-2 approve without payment → no finance link + focus miss", () => {
  test("approve without payment has no finance link; unknown focus shows fail-soft case", async ({
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
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveWithoutPaymentButton)
    ).toBeVisible({ timeout: 20_000 });
    await clickWorkspaceApproveWithoutPaymentAndWait(page, registrationId);

    const notice = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice);
    await expect(notice).toBeVisible({ timeout: 20_000 });
    await expect(notice).toContainText(new RegExp(escapeRegExp(guestName), "i"));
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeFinanceLink)
    ).toHaveCount(0);

    const missingId = "00000000-0000-4000-8000-00000000dead";
    await page.goto(
      `/tours/${WORKSPACE_SMOKE_TOUR_ID}/workspace?tab=finance&focusRegistrationId=${missingId}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.focusMiss)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.openCase)).toBeVisible();
  });
});
