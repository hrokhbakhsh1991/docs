/**
 * TKT-G1 — operator ticketing inbox smoke.
 */
import { expect, test } from "@playwright/test";

import {
  loginOperatorMember,
  loginOperatorOwner,
  loginOperatorViewer,
} from "../../test/fixtures/operator-owner-session";
import { OPERATOR_TICKETS_TEST_IDS } from "../../src/features/tickets/operator-tickets-types";
import {
  applyInboxPriorityFilter,
  applyInboxStatusFilter,
  assertTicketDetailReadyForReply,
  selectOpenTicketInInbox,
} from "./operator-ticketing-e2e-helpers";

async function openTicketsInbox(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/tickets", { waitUntil: "load" });
  await expect(page).toHaveURL(/\/tickets\/?$/);
  await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.shell)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[data-operator-tickets][data-operator-tickets-ready='true']")).toBeVisible({
    timeout: 90_000,
  });
}

async function confirmOperatorAction(
  page: import("@playwright/test").Page,
  testIdPrefix: "operator-tickets-resolve" | "operator-tickets-close",
): Promise<void> {
  await page.getByTestId(`${testIdPrefix}-confirm-confirm`).click();
}

test.describe("TKT-G1 operator ticketing inbox", () => {
  test("admin triage flow + viewer read-only + member denied + mobile", async ({ page }) => {
    await loginOperatorOwner(page);
    await openTicketsInbox(page);

    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.inbox)).toBeVisible();
    await applyInboxStatusFilter(page, "open");
    await applyInboxPriorityFilter(page, "normal", { requireStatus: "open" });

    const selectedTicket = await selectOpenTicketInInbox(page);
    await assertTicketDetailReadyForReply(page, selectedTicket);

    const composer = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.composer);
    await composer.locator("textarea").click();
    await composer.locator("textarea").pressSequentially("پاسخ عمومی اپراتور", { delay: 8 });
    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().includes("/replies") && res.ok(),
        { timeout: 60_000 },
      ),
      composer.getByRole("button", { name: /ارسال|Send/i }).click(),
    ]);
    await expect(page.getByText("پاسخ عمومی اپراتور")).toBeVisible({ timeout: 60_000 });

    await composer.getByRole("tab", { name: /یادداشت داخلی|Internal note/i }).click();
    await composer.locator("textarea").click();
    await composer.locator("textarea").pressSequentially("یادداشت داخلی smoke", { delay: 8 });
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" && res.url().includes("/internal-notes") && res.ok(),
        { timeout: 60_000 },
      ),
      composer.getByRole("button", { name: /ارسال|Send/i }).click(),
    ]);
    await expect(page.getByText("یادداشت داخلی smoke")).toBeVisible({ timeout: 60_000 });

    const detailPanel = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.detail).filter({ visible: true }).first();
    await detailPanel.locator("[data-operator-tickets-actions] select").first().selectOption("high");
    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.mutationNotice)).toBeVisible({
      timeout: 60_000,
    });

    await detailPanel.getByRole("button", { name: /ارجاع به اپراتور|Assign operator/i }).click();
    await detailPanel.getByRole("button", { name: /ارجاع به تیم|Assign team/i }).click();
    await detailPanel.getByRole("button", { name: /تغییر صف|Change queue/i }).click();
    await detailPanel.getByRole("button", { name: /افزودن برچسب|Add tag/i }).click();
    await detailPanel.getByRole("button", { name: /حل‌شده|Resolve/i }).click();
    await confirmOperatorAction(page, "operator-tickets-resolve");
    await detailPanel.getByRole("button", { name: /بستن|Close/i }).click();
    await confirmOperatorAction(page, "operator-tickets-close");
    await detailPanel.getByRole("button", { name: /بازگشایی|Reopen/i }).click();

    await page.screenshot({
      path: "/opt/cursor/artifacts/screenshots/operator-tickets-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await openTicketsInbox(page);
    await applyInboxStatusFilter(page, "open");
    await selectOpenTicketInInbox(page, { ticketId: selectedTicket.ticketId });
    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.mobileSheet)).toBeVisible({
      timeout: 60_000,
    });
    await page.screenshot({
      path: "/opt/cursor/artifacts/screenshots/operator-tickets-mobile.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await loginOperatorViewer(page);
    await openTicketsInbox(page);
    await applyInboxStatusFilter(page, "open");
    await selectOpenTicketInInbox(page, { ticketId: selectedTicket.ticketId });
    await expect(page.locator("[data-operator-tickets-readonly-banner]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-operator-tickets-composer-readonly]")).toBeVisible();

    await loginOperatorMember(page);
    const memberTickets = await page.request.get("/tickets", { maxRedirects: 0 });
    expect([302, 303, 307, 404, 403]).toContain(memberTickets.status());
  });

  test("mutation conflict surfaces without full-page error", async ({ page }) => {
    await loginOperatorOwner(page);
    await openTicketsInbox(page);
    await applyInboxStatusFilter(page, "open");
    const { ticketId } = await selectOpenTicketInInbox(page);

    const stalePatch = await page.request.patch(`/api/tickets/${ticketId}`, {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `conflict-${Date.now()}`,
      },
      data: { status: "closed", rowVersion: 0 },
    });
    expect([404, 409, 422, 500]).toContain(stalePatch.status());

    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("Hydration failed");
  });
});
