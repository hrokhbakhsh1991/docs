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

async function openTicketsInbox(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/tickets", { waitUntil: "load" });
  await expect(page).toHaveURL(/\/tickets\/?$/);
  await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.shell)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[data-operator-tickets][data-operator-tickets-ready='true']")).toBeVisible({
    timeout: 90_000,
  });
}

async function openTicketDetail(page: import("@playwright/test").Page): Promise<void> {
  const rows = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow);
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  const readyLocator = page
    .locator("[data-operator-tickets-detail-state='ready']")
    .filter({ visible: true });
  if (await readyLocator.isVisible()) {
    return;
  }
  const target = rows.first();
  await target.click();
  await expect(readyLocator).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("TKT-G1 operator ticketing inbox", () => {
  test("admin triage flow + viewer read-only + member denied + mobile", async ({ page }) => {
    await loginOperatorOwner(page);
    await openTicketsInbox(page);

    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.inbox)).toBeVisible();
    await page.getByTestId(OPERATOR_TICKETS_TEST_IDS.filterStatus).selectOption("open");
    await page.getByTestId(OPERATOR_TICKETS_TEST_IDS.filterPriority).selectOption("normal");
    await expect(page.locator("[data-operator-tickets-inbox][data-operator-tickets-state='ready']")).toBeVisible({
      timeout: 60_000,
    });

    await openTicketDetail(page);

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

    await page.locator("[data-operator-tickets-actions] select").first().selectOption("high");
    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.mutationNotice)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: /ارجاع به اپراتور|Assign operator/i }).click();
    await page.getByRole("button", { name: /ارجاع به تیم|Assign team/i }).click();
    await page.getByRole("button", { name: /تغییر صف|Change queue/i }).click();
    await page.getByRole("button", { name: /افزودن برچسب|Add tag/i }).click();
    await page.getByRole("button", { name: /حل‌شده|Resolve/i }).click();
    await page.getByRole("button", { name: /بستن|Close/i }).click();
    await page.getByRole("button", { name: /بازگشایی|Reopen/i }).click();

    await page.screenshot({
      path: "/opt/cursor/artifacts/screenshots/operator-tickets-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await openTicketsInbox(page);
    await openTicketDetail(page);
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
    await openTicketDetail(page);
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
    await openTicketDetail(page);

    const ticketId =
      (await page
        .getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow)
        .first()
        .getAttribute("data-ticket-id")) ?? "";
    expect(ticketId.length).toBeGreaterThan(0);
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
