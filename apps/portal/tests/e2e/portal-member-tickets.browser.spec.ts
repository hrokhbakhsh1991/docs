/**
 * TKT-BQC — portal member tickets browser closure (Postgres).
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";

const SMOKE_MEMBER_PHONE = "+15550001003";
const SMOKE_MEMBER_NAME = "Smoke Member";

test.describe.configure({ mode: "serial" });

test.describe("portal member tickets — TKT-BQC walkthrough", () => {
  test("TKT-BQC-WALK list page desktop screenshot", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, {
      phone: SMOKE_MEMBER_PHONE,
      fullName: SMOKE_MEMBER_NAME,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']")
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-ticket-row]").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("[data-portal-member-ticket-code]").first()).toBeVisible();

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-tickets-list-desktop.png",
      fullPage: true,
    });
  });

  test("TKT-BQC-WALK detail page with conversation screenshot", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, {
      phone: SMOKE_MEMBER_PHONE,
      fullName: SMOKE_MEMBER_NAME,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-ticket-row-link]").first()).toBeVisible({
      timeout: 90_000,
    });
    await page.locator("[data-portal-member-ticket-row-link]").first().click();
    await page.waitForURL(/\/me\/tickets\//, { timeout: 60_000 });

    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']")
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-ticket-detail-hero]")).toBeVisible();
    await expect(page.locator("[data-portal-member-ticket-messages] li").first()).toBeVisible();

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-tickets-detail-desktop.png",
      fullPage: true,
    });
  });

  test("TKT-BQC-WALK mobile RTL list screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticatePortalMemberForTickets(page, {
      phone: SMOKE_MEMBER_PHONE,
      fullName: SMOKE_MEMBER_NAME,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']")
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-tickets-list-mobile-rtl.png",
      fullPage: true,
    });
  });

  test("TKT-BQC-02 resolved filter via URL shows active chip", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await authenticatePortalMemberForTickets(page, {
      phone: SMOKE_MEMBER_PHONE,
      fullName: SMOKE_MEMBER_NAME,
    });

    await page.goto("/me/tickets?status=resolved", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-tickets-filter]")).toBeVisible({
      timeout: 90_000,
    });

    const resolvedChip = page.getByRole("button", { name: "حل‌شده" });
    await expect(resolvedChip).toHaveAttribute("aria-pressed", "true");

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-tickets-filter-resolved.png",
      fullPage: true,
    });
  });
});

test.describe("portal member tickets — TKT-BQC journey", () => {
  test("TKT-BQC-01 create reply and list persistence with UI evidence", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const ticketSubject = `TKT-BQC-${Date.now()}`;
    const ticketBody = "درخواست تست BQC برای بررسی ظاهر و عملکرد";

    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: "TKT BQC Member",
    });

    await page.goto("/me/tickets/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-tickets-new-form]")).toBeVisible({
      timeout: 60_000,
    });

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-tickets-new-form.png",
      fullPage: true,
    });

    await page.locator('select[name="categoryCode"]').selectOption("general");
    await page.locator('input[name="subject"]').click();
    await page.locator('input[name="subject"]').pressSequentially(ticketSubject, { delay: 10 });
    await page.locator('textarea[name="body"]').click();
    await page.locator('textarea[name="body"]').pressSequentially(ticketBody, { delay: 10 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().includes("/api/me/tickets"),
        { timeout: 90_000 }
      ),
      page.locator('[data-portal-member-tickets-new-form] button[type="submit"]').click(),
    ]);

    await page.waitForURL(/\/me\/tickets\/[^/]+$/, { timeout: 90_000 });
    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']")
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-ticket-detail-subject]")).toContainText(
      ticketSubject
    );
    await expect(page.locator("[data-portal-member-ticket-code]")).toBeVisible();

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-tickets-created-detail.png",
      fullPage: true,
    });

    const replyText = "پاسخ تست BQC از عضو";
    await page.locator("[data-portal-member-ticket-composer] textarea").click();
    await page
      .locator("[data-portal-member-ticket-composer] textarea")
      .pressSequentially(replyText, { delay: 10 });
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/messages") &&
          res.status() === 201,
        { timeout: 60_000 }
      ),
      page.locator("[data-portal-member-ticket-composer] button[type='submit']").click(),
    ]);

    await expect(page.getByText(replyText)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator('[data-portal-member-ticket-message][data-author="member"]').last()
    ).toBeVisible();

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-tickets-after-reply.png",
      fullPage: true,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']")
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(ticketSubject)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator(`[data-portal-member-ticket-subject]:has-text("${ticketSubject}")`)
    ).toBeVisible();
  });
});
