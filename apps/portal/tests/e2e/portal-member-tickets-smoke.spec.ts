/**
 * TKT-F1 — member portal ticketing smoke (create → view → reply → reopen).
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";
import {
  readMemberTicketRowVersion,
  resolveTicketForSmoke,
} from "./fixtures/resolve-ticket-for-smoke";

const TICKET_SUBJECT = `TKT-SMOKE-${Date.now()}`;
const TICKET_BODY = "درخواست تست پشتیبانی از Playwright";

test("TKT-F1-SMOKE member ticketing create view reply reopen", async ({ page }) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await authenticatePortalMemberForTickets(page, {
    phone,
    fullName: "Ticketing Smoke Member",
  });

  await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator("[data-testid='portal-shell-nav-tickets']")).toBeVisible({
    timeout: 60_000,
  });

  await page.locator("[data-portal-member-tickets-new-cta]").click();
  await expect(page.locator("[data-portal-member-tickets-new-form]")).toBeVisible({ timeout: 60_000 });

  await page.locator('select[name="categoryCode"]').selectOption("general");
  await page.locator('input[name="subject"]').click();
  await page.locator('input[name="subject"]').pressSequentially(TICKET_SUBJECT, { delay: 10 });
  await page.locator('textarea[name="body"]').click();
  await page.locator('textarea[name="body"]').pressSequentially(TICKET_BODY, { delay: 10 });

  await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/api/me/tickets"),
      { timeout: 90_000 },
    ),
    page.locator('[data-portal-member-tickets-new-form] button[type="submit"]').click(),
  ]);

  await page.waitForURL(/\/me\/tickets\/[^/]+$/, { timeout: 90_000 });
  await expect(page.locator("[data-portal-member-ticket-detail]")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(TICKET_SUBJECT)).toBeVisible();

  await page.locator("[data-portal-member-ticket-composer] textarea").click();
  await page.locator("[data-portal-member-ticket-composer] textarea").pressSequentially("پاسخ تست عضو", {
    delay: 10,
  });
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/messages") &&
        res.status() === 201,
      { timeout: 60_000 },
    ),
    page.locator("[data-portal-member-ticket-composer] button[type='submit']").click(),
  ]);
  await expect(page.getByText("پاسخ تست عضو")).toBeVisible({ timeout: 60_000 });

  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator('[data-portal-member-ticket-attachment-field] input[type="file"]').setInputFiles({
    name: "smoke-attachment.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await page.locator("[data-portal-member-ticket-attachment-field] button").click();
  await expect(page.locator("[data-portal-member-ticket-attachment-success]")).toBeVisible({
    timeout: 60_000,
  });

  const ticketId = page.url().split("/").pop() ?? "";
  const rowVersion = await readMemberTicketRowVersion(page.request, ticketId);
  await resolveTicketForSmoke(page.request, ticketId, rowVersion);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-ticket-status][data-status='resolved']")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-member-ticket-detail][data-client-ready='true']")).toBeVisible({
    timeout: 60_000,
  });
  const reopenButton = page.getByRole("button", { name: "بازگشایی درخواست" });

  await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/reopen") && res.ok(),
      { timeout: 60_000 },
    ),
    reopenButton.click(),
  ]);
  await expect(page.locator("[data-portal-member-ticket-status][data-status='open']")).toBeVisible({
    timeout: 60_000,
  });

  await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(TICKET_SUBJECT)).toBeVisible({ timeout: 60_000 });

  await page.screenshot({
    path: "/opt/cursor/artifacts/screenshots/portal-tickets-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/opt/cursor/artifacts/screenshots/portal-tickets-mobile.png",
    fullPage: true,
  });
});
