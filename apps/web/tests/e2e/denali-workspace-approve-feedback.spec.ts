/**
 * UX-BKG-56 / H-08 — workspace approve feedback in inspection + inline list.
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  ensureTourHasApprovalCapacity,
} from "./fixtures/tour-workspace-smoke";
import {
  resolveChainSmokePublishedTourId,
  seedChainGuestRegistrationViaApi,
} from "../../test/fixtures/p6-chain-guest-api";

function workspaceRegistrationsPath(): string {
  return `/tours/${resolveChainSmokePublishedTourId()}/workspace`;
}

test.describe("denali-workspace-approve-feedback.spec.ts — UX-BKG-56", () => {
  test("workspace inspection approve shows action notice + removes pending row", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `WS Inspect Approve ${stamp}`;
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });
    await seedChainGuestRegistrationViaApi(request, {
      guestName,
      email: `ws-inspect-${stamp}@denali-smoke.local`,
    });

    await page.goto(workspaceRegistrationsPath());
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 30_000,
    });

    const guestRow = page
      .locator("[data-booking-row]")
      .filter({ hasText: new RegExp(guestName, "i") });
    await expect(guestRow).toBeVisible({ timeout: 15_000 });
    await guestRow
      .locator(`[data-testid^="${BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxRow}-"]`)
      .click();

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toBeVisible();
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/approve") &&
        response.request().method() === "POST" &&
        response.ok()
    );
    await page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton).click();
    await approveResponse;

    const notice = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice);
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(notice).toContainText(new RegExp(guestName, "i"));
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeTransportLink)
    ).toBeVisible();

    await expect(
      page.locator("[data-booking-row]").filter({ hasText: new RegExp(guestName, "i") })
    ).toBeVisible({ timeout: 15_000 });
    const approvedRow = page
      .locator("[data-booking-row]")
      .filter({ hasText: new RegExp(guestName, "i") });
    await expect(approvedRow.locator("[data-operator-booking-row-status]")).toContainText(
      /approved|تأییدشده/i,
      { timeout: 15_000 }
    );
    await expect(
      approvedRow.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inlineApproveButton)
    ).toHaveCount(0);
  });

  test("workspace inline approve (2-click) shows action notice", async ({ page, request }) => {
    const stamp = Date.now();
    const guestName = `WS Inline Approve ${stamp}`;
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });
    await seedChainGuestRegistrationViaApi(request, {
      guestName,
      email: `ws-inline-${stamp}@denali-smoke.local`,
    });

    await page.goto(workspaceRegistrationsPath());
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 30_000,
    });

    const guestRow = page
      .locator("[data-booking-row]")
      .filter({ hasText: new RegExp(guestName, "i") });
    await expect(guestRow).toBeVisible({ timeout: 15_000 });

    const inlineBtn = guestRow.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inlineApproveButton);
    await expect(inlineBtn).toBeVisible();
    await expect(inlineBtn).toHaveAttribute("data-armed", "false");

    await inlineBtn.click();
    await expect(inlineBtn).toHaveAttribute("data-armed", "true");

    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/approve") &&
        response.request().method() === "POST" &&
        response.ok()
    );
    await inlineBtn.click();
    await approveResponse;

    const notice = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice);
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(notice).toContainText(new RegExp(guestName, "i"));
  });
});
