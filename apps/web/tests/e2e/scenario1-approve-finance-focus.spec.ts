/**
 * Manual QA — Scenario 1: approve unpaid → notice → finance focus.
 * Not part of CI pack; run ad-hoc against denali.admin.localhost.
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const TOUR_ID = process.env.QA_TOUR_ID?.trim() || "9fc949a0-72a3-4f57-b888-7ba7c81b58db";

type BookingRow = {
  readonly id?: string;
  readonly guestLabel?: string;
  readonly status?: string;
  readonly paymentStatus?: string;
};

test.describe("scenario-1 approve unpaid → finance focus", () => {
  test("approve pending unpaid shows finance link and focuses guest on Money Inbox", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    // Resolve a concrete unpaid pending guest via BFF (more stable than waiting on listbox paint).
    let unpaid: BookingRow | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const listRes = await page.request.get(
        `/api/bookings?tourId=${encodeURIComponent(TOUR_ID)}&status=pending&view=ops&limit=50`
      );
      if (!listRes.ok()) {
        await page.waitForTimeout(1500);
        continue;
      }
      const body = (await listRes.json()) as { items?: BookingRow[] };
      unpaid =
        body.items?.find(
          (row) =>
            row.status === "pending" &&
            (row.paymentStatus === "unpaid" || row.paymentStatus === "partial") &&
            typeof row.guestLabel === "string" &&
            row.guestLabel.trim().length > 0
        ) ?? null;
      if (unpaid !== null) {
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(unpaid, "need at least one pending unpaid/partial on QA tour").not.toBeNull();
    const guestName = unpaid!.guestLabel!.trim();
    const registrationId = unpaid!.id!;
    expect(registrationId.length).toBeGreaterThan(0);

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
      const detailPanel = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel);
      await expect(detailPanel).toBeVisible({ timeout: 10_000 });
      await expect(
        detailPanel.getByTestId("operator-tour-workspace-finance-actions").or(
          detailPanel.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)
        )
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        detailPanel.getByTestId(`${TOUR_WORKSPACE_FINANCE_TEST_IDS.openCase}-${registrationId}`)
      ).toBeVisible();
    }

    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.openHub)).toBeVisible();
  });
});
