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
  OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
  seedChainGuestRegistrationViaApi,
} from "../../test/fixtures/p6-chain-guest-api";

function workspaceRegistrationsPath(): string {
  return `/tours/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}/workspace`;
}

test.describe("denali-workspace-approve-feedback.spec.ts — UX-BKG-56", () => {
  test("workspace inspection approve shows action notice + removes pending row", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `WS Inspect Approve ${stamp}`;
    await seedChainGuestRegistrationViaApi(request, {
      guestName,
      email: `ws-inspect-${stamp}@denali-smoke.local`,
    });

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(workspaceRegistrationsPath());
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 30_000,
    });

    const guestRow = page.getByRole("button", { name: new RegExp(guestName, "i") });
    await expect(guestRow).toBeVisible({ timeout: 15_000 });
    await guestRow.click();

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

    await expect(page.getByRole("button", { name: new RegExp(guestName, "i") })).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("workspace inline approve (2-click) shows action notice", async ({ page, request }) => {
    const stamp = Date.now();
    const guestName = `WS Inline Approve ${stamp}`;
    await seedChainGuestRegistrationViaApi(request, {
      guestName,
      email: `ws-inline-${stamp}@denali-smoke.local`,
    });

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(workspaceRegistrationsPath());
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 30_000,
    });

    const guestRow = page.getByRole("button", { name: new RegExp(guestName, "i") });
    await expect(guestRow).toBeVisible({ timeout: 15_000 });

    const inlineBtn = page
      .getByRole("option", { name: new RegExp(guestName, "i") })
      .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inlineApproveButton);
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
