/**
 * Manual QA — Scenario 3: tabs only (no banner CTAs).
 * Approve → Transport roster → Finance filters/search (settled hides tools).
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TRANSPORT_TEST_IDS } from "../../src/features/tours/tour-workspace-transport-logic";
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

const FILTER_LABELS = {
  all: /^(همه موارد|All follow-ups)$/i,
  unpaid: /^(پرداخت‌نشده|Unpaid)$/i,
  partial: /^(پرداخت ناقص|Partial payment)$/i,
} as const;

test.describe("scenario-3 tabs: transport roster + finance filters", () => {
  test("approve then transport roster; finance filter/search without banner", async ({ page }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

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
    expect(unpaid, "need pending unpaid/partial on QA tour").not.toBeNull();
    const guestName = unpaid!.guestLabel!.trim();
    const registrationId = unpaid!.id!;
    const guestRe = new RegExp(guestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    await page.goto(`/tours/${TOUR_ID}/workspace`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 90_000,
    });

    const guestOption = page.getByRole("option", { name: guestRe });
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

    // Scenario 3: use subnav tabs only — do not click banner finance/transport links.
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabTransport).click();
    await expect(page).toHaveURL(/tab=transport/);
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.transportPanel)).toBeVisible({
      timeout: 90_000,
    });
    const transportTable = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table);
    await expect(transportTable).toBeVisible({ timeout: 60_000 });
    await expect(transportTable.getByRole("cell", { name: guestRe }).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabFinance).click();
    await expect(page).toHaveURL(/tab=finance/);
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible({
      timeout: 90_000,
    });

    const settled = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.allSettled);
    const filters = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.filters);
    const search = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.search);
    await expect(filters.or(settled)).toBeVisible({ timeout: 60_000 });

    if ((await settled.count()) > 0 && (await filters.count()) === 0) {
      // Settled empty → no cluttered filter/search chrome.
      await expect(search).toHaveCount(0);
      return;
    }

    await expect(filters).toBeVisible();
    await expect(search).toBeVisible();

    for (const label of Object.values(FILTER_LABELS)) {
      await expect(filters.getByRole("button", { name: label })).toBeVisible({
        timeout: 10_000,
      });
    }

    const guestList = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList);
    const empty = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.empty);

    const assertKindOrEmpty = async (kind: string) => {
      await expect(guestList.or(empty)).toBeVisible({ timeout: 15_000 });
      if (await guestList.isVisible()) {
        const kinds = await guestList
          .locator("[data-finance-kind]")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-finance-kind")));
        expect(kinds.length).toBeGreaterThan(0);
        expect(kinds.every((k) => k === kind)).toBeTruthy();
      } else {
        await expect(empty).toBeVisible();
      }
    };

    await filters.getByRole("button", { name: FILTER_LABELS.unpaid }).click();
    await assertKindOrEmpty("unpaid");

    await filters.getByRole("button", { name: FILTER_LABELS.partial }).click();
    await assertKindOrEmpty("partial");

    // Name search against a visible row (tour outstanding may paginate past the just-approved guest).
    await filters.getByRole("button", { name: FILTER_LABELS.all }).click();
    await search.fill("");
    await expect(guestList).toBeVisible({ timeout: 15_000 });
    const firstRow = guestList.locator("[data-finance-registration-id]").first();
    await expect(firstRow).toBeVisible();
    const sampleRegistrationId = await firstRow.getAttribute("data-finance-registration-id");
    expect(sampleRegistrationId, "guest row needs registration id").toBeTruthy();
    const rowText = ((await firstRow.innerText()) || "").trim();
    const searchToken =
      rowText
        .split(/\s+/)
        .map((part) => part.trim())
        .find((part) => part.length >= 3 && !/^\d/.test(part)) ?? rowText.slice(0, 8);
    expect(searchToken.length).toBeGreaterThan(0);
    await search.fill(searchToken);
    await expect(
      guestList.locator(`[data-finance-registration-id="${sampleRegistrationId}"]`)
    ).toBeVisible({ timeout: 10_000 });
    await search.fill("___no_such_guest_zz___");
    await expect(empty).toBeVisible({ timeout: 10_000 });
  });
});
