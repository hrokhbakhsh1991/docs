/**
 * Operator ticketing Playwright helpers — filter sync, open-ticket selection, fixture cleanup.
 */
import { execSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";

import { OPERATOR_TICKETS_TEST_IDS } from "../../src/features/tickets/operator-tickets-types";

export const OPERATOR_TICKETING_SMOKE_SUBJECT_PREFIX = "TKT-OP-SMOKE";
export const OPERATOR_TICKETING_BULK_SUBJECT_PREFIX = "TKT-BULK-";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

function operatorTicketingDatabaseAdminUrl(): string {
  return (
    process.env.DATABASE_URL_ADMIN?.trim() ||
    "postgresql://postgres:postgres@127.0.0.1:5434/app_tour_dev"
  );
}

export async function waitForInboxListReady(page: Page): Promise<void> {
  await expect(
    page.locator("[data-operator-tickets-inbox][data-operator-tickets-state='ready']"),
  ).toBeVisible({ timeout: 60_000 });
}

export async function applyInboxStatusFilter(
  page: Page,
  status: "open" | "pending_member" | "resolved" | "closed" | "all",
): Promise<void> {
  const listResponse = page.waitForResponse(
    (response) => {
      if (response.request().method() !== "GET" || !response.ok()) {
        return false;
      }
      const url = response.url();
      if (!url.includes("/api/tickets")) {
        return false;
      }
      if (status === "all") {
        return !url.includes("status=");
      }
      return url.includes(`status=${status}`);
    },
    { timeout: 60_000 },
  );
  await page.getByTestId(OPERATOR_TICKETS_TEST_IDS.filterStatus).selectOption(status);
  await listResponse;
  if (status === "all") {
    await expect(page).not.toHaveURL(/[?&]status=/);
  } else {
    await expect(page).toHaveURL(new RegExp(`[?&]status=${status}(?:&|$)`));
  }
  await waitForInboxListReady(page);
}

export async function applyInboxPriorityFilter(
  page: Page,
  priority: "low" | "normal" | "high" | "urgent" | "all",
  options?: { readonly requireStatus?: string },
): Promise<void> {
  const requiredStatus = options?.requireStatus;
  const listResponse = page.waitForResponse(
    (response) => {
      if (response.request().method() !== "GET" || !response.ok()) {
        return false;
      }
      const url = response.url();
      if (!url.includes("/api/tickets")) {
        return false;
      }
      if (requiredStatus !== undefined && !url.includes(`status=${requiredStatus}`)) {
        return false;
      }
      if (priority === "all") {
        return !url.includes("priority=");
      }
      return url.includes(`priority=${priority}`);
    },
    { timeout: 60_000 },
  );
  await page.getByTestId(OPERATOR_TICKETS_TEST_IDS.filterPriority).selectOption(priority);
  await listResponse;
  if (priority === "all") {
    await expect(page).not.toHaveURL(/[?&]priority=/);
  } else {
    await expect(page).toHaveURL(new RegExp(`[?&]priority=${priority}(?:&|$)`));
  }
  if (requiredStatus !== undefined) {
    await expect(page).toHaveURL(new RegExp(`[?&]status=${requiredStatus}(?:&|$)`));
  }
  await waitForInboxListReady(page);
}

export async function selectOpenTicketInInbox(
  page: Page,
  options?: { readonly subjectPrefix?: string; readonly ticketId?: string },
): Promise<{ ticketId: string; subjectPrefix: string }> {
  const subjectPrefix = options?.subjectPrefix ?? OPERATOR_TICKETING_SMOKE_SUBJECT_PREFIX;
  const openRow =
    options?.ticketId !== undefined
      ? page
          .locator(
            `[data-testid="${OPERATOR_TICKETS_TEST_IDS.inboxRow}"][data-ticket-id="${options.ticketId}"]`,
          )
          .filter({
            has: page.locator("[data-operator-status-badge]").filter({ hasText: /باز|Open/i }),
          })
      : page
          .getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow)
          .filter({ hasText: subjectPrefix })
          .filter({
            has: page.locator("[data-operator-status-badge]").filter({ hasText: /باز|Open/i }),
          })
          .first();

  await expect(openRow).toBeVisible({ timeout: 60_000 });
  const ticketId = options?.ticketId ?? (await openRow.getAttribute("data-ticket-id")) ?? "";
  expect(ticketId.length).toBeGreaterThan(0);

  const detailResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/api/tickets/${ticketId}`) &&
      response.ok(),
    { timeout: 60_000 },
  );
  await openRow.getByRole("button").click();
  await detailResponse;

  const detailPanel = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.detail).filter({ visible: true }).first();
  await expect(detailPanel).toHaveAttribute("data-operator-tickets-detail-state", "ready");
  if (options?.ticketId === undefined) {
    await expect(detailPanel.locator("h2")).toContainText(subjectPrefix);
  }
  await expect(
    detailPanel.locator("[data-operator-status-badge]").filter({ hasText: /باز|Open/i }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`ticketId=${ticketId}`));

  return { ticketId, subjectPrefix };
}

export async function assertTicketDetailReadyForReply(
  page: Page,
  expected: { readonly ticketId: string; readonly subjectPrefix: string },
): Promise<void> {
  const detailPanel = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.detail).filter({ visible: true }).first();
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel.locator("h2")).toContainText(expected.subjectPrefix);
  await expect(
    detailPanel.locator("[data-operator-status-badge]").filter({ hasText: /باز|Open/i }),
  ).toBeVisible();
  await expect(page.locator("[data-operator-tickets-composer-readonly]")).toHaveCount(0);

  const composer = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.composer);
  await expect(composer).toBeVisible();
  await expect(composer.locator("textarea")).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(`ticketId=${expected.ticketId}`));
}

export function deleteOperatorTicketingFixtureTickets(subjects: readonly string[]): void {
  if (subjects.length === 0) {
    return;
  }
  const conditions = subjects
    .map((subject) => `subject = '${subject.replace(/'/g, "''")}'`)
    .join(" OR ");
  const sql = `DELETE FROM tickets WHERE tenant_id = '${OPERATOR_SMOKE_TENANT_ID}' AND (${conditions});`;
  execSync(`psql "${operatorTicketingDatabaseAdminUrl()}" -v ON_ERROR_STOP=1 -c "${sql}"`, {
    stdio: "pipe",
  });
}

export function deleteOperatorTicketingFixtureTicketsBySubjectPrefix(prefix: string): void {
  const escaped = prefix.replace(/'/g, "''");
  const sql = `DELETE FROM tickets WHERE tenant_id = '${OPERATOR_SMOKE_TENANT_ID}' AND subject LIKE '${escaped}%';`;
  execSync(`psql "${operatorTicketingDatabaseAdminUrl()}" -v ON_ERROR_STOP=1 -c "${sql}"`, {
    stdio: "pipe",
  });
}
