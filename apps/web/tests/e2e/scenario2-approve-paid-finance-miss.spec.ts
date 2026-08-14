/**
 * Manual QA — Scenario 2: approve paid (no remaining) → no finance CTA;
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

const TOUR_ID =
  process.env.QA_TOUR_ID?.trim() || "9fc949a0-72a3-4f57-b888-7ba7c81b58db";

type BookingRow = {
  readonly id?: string;
  readonly guestLabel?: string;
  readonly status?: string;
  readonly paymentStatus?: string;
};

test.describe("scenario-2 approve paid → no finance link + focus miss", () => {
  test("approve pending paid has no finance link; unknown focus shows fail-soft case", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    let paidPending: BookingRow | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const listRes = await page.request.get(
        `/api/bookings?tourId=${encodeURIComponent(TOUR_ID)}&status=pending&view=ops&limit=50`
      );
      if (!listRes.ok()) {
        await page.waitForTimeout(1500);
        continue;
      }
      const body = (await listRes.json()) as { items?: BookingRow[] };
      paidPending =
        body.items?.find(
          (row) =>
            row.status === "pending" &&
            row.paymentStatus === "paid" &&
            typeof row.guestLabel === "string" &&
            row.guestLabel.trim().length > 0
        ) ?? null;
      if (paidPending !== null) {
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(paidPending, "need a pending paid guest (seed paymentStatus=paid)").not.toBeNull();
    const guestName = paidPending!.guestLabel!.trim();
    const registrationId = paidPending!.id!;

    await page.goto(`/tours/${TOUR_ID}/workspace`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 90_000,
    });

    const guestOption = page.getByRole("option", {
      name: new RegExp(guestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    });
    await expect(guestOption).toBeVisible({ timeout: 60_000 });
    await guestOption.getByRole("button").first().click();

    const approve = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton);
    await expect(approve).toBeVisible({ timeout: 20_000 });

    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${registrationId}/approve`) &&
        response.request().method() === "POST"
    );
    await approve.click();
    const res = await approveResponse;
    expect(res.ok(), await res.text()).toBeTruthy();

    const notice = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice);
    await expect(notice).toBeVisible({ timeout: 20_000 });
    await expect(notice).toContainText(
      new RegExp(guestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    );
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeTransportLink)
    ).toBeVisible();

    // Paid / no remaining → finance link must not appear on the success notice.
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeFinanceLink)
    ).toHaveCount(0);

    // Fail-soft: focus a registration that is not in this tour money queue.
    const missingId = "00000000-0000-4000-8000-00000000dead";
    await page.goto(
      `/tours/${TOUR_ID}/workspace?tab=finance&focusRegistrationId=${missingId}`,
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
