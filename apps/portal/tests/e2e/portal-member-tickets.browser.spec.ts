/**
 * TKT-BQC — portal member tickets browser closure (Postgres).
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";
import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";
import {
  operatorResolveTicketViaUi,
  withOperatorTicketingUi,
} from "./fixtures/operator-ticketing-ui";

const SMOKE_MEMBER_PHONE = "+15550001003";
const SMOKE_MEMBER_NAME = "Smoke Member";

test.describe("portal member tickets — TKT-BQC walkthrough", () => {
  test.describe.configure({ mode: "serial" });
  test("TKT-BQC-WALK list page desktop screenshot", async ({ page }) => {
    await authenticatePortalMemberForTickets(page, {
      phone: SMOKE_MEMBER_PHONE,
      fullName: SMOKE_MEMBER_NAME,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-ticket-row]").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("[data-portal-member-ticket-code]").first()).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-list-desktop.png", { fullPage: true });
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
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-ticket-detail-hero]")).toBeVisible();
    await expect(page.locator("[data-portal-member-ticket-messages] li").first()).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-detail-desktop.png", { fullPage: true });
  });

  test("TKT-BQC-WALK mobile RTL list screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticatePortalMemberForTickets(page, {
      phone: SMOKE_MEMBER_PHONE,
      fullName: SMOKE_MEMBER_NAME,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-list-mobile-rtl.png", { fullPage: true });
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

    const resolvedChip = page.getByTestId("portal-tickets-filter-resolved");
    await expect(resolvedChip).toHaveAttribute("aria-current", "page");

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-filter-resolved.png", { fullPage: true });
  });
});

test.describe("portal member tickets — TKT-BQC states", () => {
  test("TKT-BQC-03 fresh member sees empty tickets list", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: `Ticket Empty ${Date.now()}`,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-tickets-empty]")).toBeVisible();
    await expect(page.locator("[data-portal-member-ticket-row]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-empty-list.png", { fullPage: true });
  });
});

test.describe("portal member tickets — TKT-BQC journey", () => {
  test.describe.configure({ mode: "serial" });

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

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-new-form.png", { fullPage: true });

    await page.locator('select[name="categoryCode"]').selectOption("general");
    await page.locator('input[name="subject"]').click();
    await page.locator('input[name="subject"]').pressSequentially(ticketSubject, { delay: 10 });
    await page.locator('textarea[name="body"]').click();
    await page.locator('textarea[name="body"]').pressSequentially(ticketBody, { delay: 10 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().includes("/api/me/tickets"),
        { timeout: 90_000 },
      ),
      page.locator('[data-portal-member-tickets-new-form] button[type="submit"]').click(),
    ]);

    await page.waitForURL(/\/me\/tickets\/[^/]+$/, { timeout: 90_000 });
    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-ticket-detail-subject]")).toContainText(
      ticketSubject,
    );
    await expect(page.locator("[data-portal-member-ticket-code]")).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-created-detail.png", { fullPage: true });

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
        { timeout: 60_000 },
      ),
      page.locator("[data-portal-member-ticket-composer] button[type='submit']").click(),
    ]);

    await expect(page.getByText(replyText)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator('[data-portal-member-ticket-message][data-author="member"]').last(),
    ).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-after-reply.png", { fullPage: true });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(ticketSubject)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator(`[data-portal-member-ticket-subject]:has-text("${ticketSubject}")`),
    ).toBeVisible();
  });

  test("TKT-BQC-05 reopen resolved ticket from detail page", async ({ page, browser }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const ticketSubject = `TKT-BQC-REOPEN-${Date.now()}`;

    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: "TKT BQC Reopen Member",
    });

    await page.locator("[data-portal-member-tickets-new-cta]").click();
    await expect(page.locator("[data-portal-member-tickets-new-form][data-client-ready='true']")).toBeVisible({
      timeout: 60_000,
    });

    await page.locator('select[name="categoryCode"]').selectOption("general");
    await page.locator('input[name="subject"]').pressSequentially(ticketSubject, { delay: 10 });
    await page.locator('textarea[name="body"]').pressSequentially("BQC reopen journey", { delay: 10 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().includes("/api/me/tickets"),
        { timeout: 90_000 },
      ),
      page.locator('[data-portal-member-tickets-new-form] button[type="submit"]').click(),
    ]);

    await page.waitForURL(/\/me\/tickets\/[^/]+$/, { timeout: 90_000 });
    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']"),
    ).toBeVisible({ timeout: 90_000 });

    await page.locator("[data-portal-member-ticket-composer] textarea").pressSequentially(
      "پاسخ قبل از resolve",
      { delay: 10 },
    );
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

    const ticketId = page.url().split("/").pop()?.split("?")[0] ?? "";
    expect(ticketId.length).toBeGreaterThan(0);

    await withOperatorTicketingUi(browser, async (operatorPage) => {
      await operatorResolveTicketViaUi(operatorPage, { ticketId, subject: ticketSubject });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-ticket-status][data-status='resolved']")).toBeVisible({
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

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-reopened-detail.png", { fullPage: true });
  });

  test("TKT-BQC-06 filter chip click updates URL and active chip", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await authenticatePortalMemberForTickets(page, {
      phone: SMOKE_MEMBER_PHONE,
      fullName: SMOKE_MEMBER_NAME,
    });

    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });

    const resolvedChip = page.getByTestId("portal-tickets-filter-resolved");
    await resolvedChip.click();

    await page.waitForURL(/status=resolved/, { timeout: 60_000 });
    await expect(resolvedChip).toHaveAttribute("aria-current", "page");

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-filter-chip-click.png", { fullPage: true });
  });

  test("TKT-BQC-07 new ticket form shows validation errors for empty submit", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: "TKT BQC Validation",
    });

    await page.goto("/me/tickets/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-tickets-new-form][data-client-ready='true']")).toBeVisible({
      timeout: 60_000,
    });

    await page.locator('[data-portal-member-tickets-new-form] button[type="submit"]').click();
    await expect(page.locator("[data-portal-member-tickets-new-form] [role='alert']").first()).toBeVisible({
      timeout: 30_000,
    });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-form-validation.png", { fullPage: true });
  });

  test("TKT-BQC-08 attachment upload shows success state", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const ticketSubject = `TKT-BQC-ATTACH-${Date.now()}`;

    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: "TKT BQC Attachment",
    });

    await page.locator("[data-portal-member-tickets-new-cta]").click();
    await expect(page.locator("[data-portal-member-tickets-new-form][data-client-ready='true']")).toBeVisible({
      timeout: 60_000,
    });

    await page.locator('select[name="categoryCode"]').selectOption("general");
    await page.locator('input[name="subject"]').pressSequentially(ticketSubject, { delay: 10 });
    await page.locator('textarea[name="body"]').pressSequentially("BQC attachment journey", { delay: 10 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().includes("/api/me/tickets"),
        { timeout: 90_000 },
      ),
      page.locator('[data-portal-member-tickets-new-form] button[type="submit"]').click(),
    ]);

    await page.waitForURL(/\/me\/tickets\/[^/]+$/, { timeout: 90_000 });
    await expect(
      page.locator("[data-portal-member-ticket-detail][data-client-ready='true']"),
    ).toBeVisible({ timeout: 90_000 });

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page.locator('[data-portal-member-ticket-attachment-field] input[type="file"]').setInputFiles({
      name: "bqc-attachment.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });
    await page.locator("[data-portal-member-ticket-attachment-field] button").click();
    await expect(page.locator("[data-portal-member-ticket-attachment-success]")).toBeVisible({
      timeout: 60_000,
    });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-tickets-attachment-success.png", { fullPage: true });
  });
});
