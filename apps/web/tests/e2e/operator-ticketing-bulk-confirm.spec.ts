/**
 * TKT-G1b — operator bulk resolve/close confirmation dialogs.
 */
import { expect, test, type Page } from "@playwright/test";

import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { OPERATOR_TICKETS_TEST_IDS } from "../../src/features/tickets/operator-tickets-types";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

async function createMemberSmokeTicket(page: Page, subject: string): Promise<void> {
  const response = await page.request.post(`${tourOpsApiBase()}/member/tickets`, {
    headers: {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": OPERATOR_SMOKE_MEMBER_USER_ID,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "x-workspace-id": "ws-operator-smoke-member",
      "Content-Type": "application/json",
      "Idempotency-Key": `bulk-confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    data: {
      categoryCode: "general",
      subject,
      body: "Bulk confirmation E2E seed ticket.",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function openTicketsInbox(page: Page): Promise<void> {
  await page.goto("/tickets", { waitUntil: "load" });
  await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.shell)).toBeVisible({ timeout: 90_000 });
  await page.getByTestId(OPERATOR_TICKETS_TEST_IDS.filterStatus).selectOption("open");
  await expect(
    page.locator("[data-operator-tickets-inbox][data-operator-tickets-state='ready']"),
  ).toBeVisible({ timeout: 60_000 });
}

async function selectTicketsBySubject(page: Page, subjects: readonly string[]): Promise<void> {
  for (const subject of subjects) {
    const row = page
      .getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow)
      .filter({ hasText: subject })
      .first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.getByRole("checkbox").check();
  }
}

async function setBulkStatus(page: Page, status: "resolved" | "closed"): Promise<void> {
  const toolbar = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.bulkToolbar);
  await toolbar.locator("select").selectOption(status);
}

async function clickBulkApply(page: Page): Promise<void> {
  await page.getByTestId(OPERATOR_TICKETS_TEST_IDS.bulkApply).click();
}

async function expectBulkConfirmDialog(page: Page): Promise<void> {
  await expect(page.getByTestId("operator-tickets-bulk-confirm-dialog")).toBeVisible({
    timeout: 10_000,
  });
}

async function cancelBulkConfirm(page: Page): Promise<void> {
  await page.getByTestId("operator-tickets-bulk-confirm-cancel").click();
  await expect(page.getByTestId("operator-tickets-bulk-confirm-dialog")).toBeHidden({
    timeout: 10_000,
  });
}

async function confirmBulkAction(page: Page): Promise<void> {
  const bulkResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/api/tickets/bulk"),
    { timeout: 60_000 },
  );
  await page.getByTestId("operator-tickets-bulk-confirm-confirm").click();
  const response = await bulkResponse;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(page.getByTestId("operator-tickets-bulk-confirm-dialog")).toBeHidden({
    timeout: 10_000,
  });
}

test.describe("TKT-G1b operator bulk destructive confirmation", () => {
  test("bulk resolve shows confirm dialog and blocks until confirmed", async ({ page }) => {
    const subjectA = `TKT-BULK-RESOLVE-A-${Date.now()}`;
    const subjectB = `TKT-BULK-RESOLVE-B-${Date.now()}`;

    await loginOperatorOwner(page);
    await createMemberSmokeTicket(page, subjectA);
    await createMemberSmokeTicket(page, subjectB);
    await openTicketsInbox(page);
    await selectTicketsBySubject(page, [subjectA, subjectB]);
    await setBulkStatus(page, "resolved");

    let bulkRequestCount = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/tickets/bulk")) {
        bulkRequestCount += 1;
      }
    });

    await clickBulkApply(page);
    await expectBulkConfirmDialog(page);
    expect(bulkRequestCount).toBe(0);

    await cancelBulkConfirm(page);
    await expect(
      page
        .getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow)
        .filter({ hasText: subjectA })
        .locator("[data-operator-status-badge]")
        .filter({ hasText: /باز|Open/i }),
    ).toBeVisible();
    expect(bulkRequestCount).toBe(0);

    await clickBulkApply(page);
    await expectBulkConfirmDialog(page);
    await confirmBulkAction(page);
    expect(bulkRequestCount).toBe(1);

    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.mutationNotice)).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page
        .getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow)
        .filter({ hasText: subjectA })
        .locator("[data-operator-status-badge]")
        .filter({ hasText: /حل‌شده|Resolved/i }),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("bulk close shows confirm dialog and blocks until confirmed", async ({ page }) => {
    const subjectA = `TKT-BULK-CLOSE-A-${Date.now()}`;
    const subjectB = `TKT-BULK-CLOSE-B-${Date.now()}`;

    await loginOperatorOwner(page);
    await createMemberSmokeTicket(page, subjectA);
    await createMemberSmokeTicket(page, subjectB);
    await openTicketsInbox(page);
    await selectTicketsBySubject(page, [subjectA, subjectB]);
    await setBulkStatus(page, "closed");

    let bulkRequestCount = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/tickets/bulk")) {
        bulkRequestCount += 1;
      }
    });

    await clickBulkApply(page);
    await expectBulkConfirmDialog(page);
    expect(bulkRequestCount).toBe(0);

    await cancelBulkConfirm(page);
    await expect(
      page
        .getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow)
        .filter({ hasText: subjectA })
        .locator("[data-operator-status-badge]")
        .filter({ hasText: /باز|Open/i }),
    ).toBeVisible();
    expect(bulkRequestCount).toBe(0);

    await clickBulkApply(page);
    await expectBulkConfirmDialog(page);
    await confirmBulkAction(page);
    expect(bulkRequestCount).toBe(1);

    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.mutationNotice)).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page
        .getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow)
        .filter({ hasText: subjectA })
        .locator("[data-operator-status-badge]")
        .filter({ hasText: /بسته|Close/i }),
    ).toBeVisible({ timeout: 60_000 });
  });
});
