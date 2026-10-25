/**
 * BOOK-BQC — portal tour purchase path under different registration/payment states.
 * Member + operator steps are real browser E2E (cross-surface).
 */
import { expect, test } from "@playwright/test";

import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";
import {
  OPERATOR_PUBLISHED_TOUR_ID,
  OPERATOR_PUBLISHED_TOUR_TITLE,
  completePortalCatalogRegistration,
} from "./fixtures/complete-portal-registration";
import {
  operatorApproveBookingViaUi,
  operatorRejectBookingViaUi,
  withOperatorBookingsUi,
} from "./fixtures/operator-booking-ui";
import {
  attachMemberReceiptFile,
  fetchMemberRegistrationId,
  minimalReceiptPngBuffer,
  submitMemberReceiptUpload,
} from "./fixtures/portal-member-registration-api";
import {
  openMemberRegistrationDetailById,
  openMemberRegistrationDetailByTitle,
  openMemberRegistrationsFromSuccess,
} from "./fixtures/portal-member-navigation";

function uniqueContact(prefix: string): { email: string; phone: string } {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    email: `${prefix}-${stamp}@denali-smoke.local`,
    phone: `+1555${stamp.replace(/\D/g, "").slice(-10).padStart(10, "0")}`,
  };
}

test.describe("portal booking purchase matrix — BOOK-BQC", () => {
  test.describe.configure({ mode: "serial" });

  test("BOOK-BQC-01 fresh catalog registration awaits club approval", async ({ page }) => {
    page.on("pageerror", (error) => console.error("BOOK-BQC pageerror:", error));
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.error("BOOK-BQC browser console:", message.text());
      }
    });
    const contact = uniqueContact("book-bqc-01");
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: "BOOK BQC 01 Pending",
      phone: contact.phone,
    });

    await openMemberRegistrationsFromSuccess(page);
    await openMemberRegistrationDetailByTitle(page, OPERATOR_PUBLISHED_TOUR_TITLE);

    await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
    await expect(page.locator("[data-portal-member-receipt-submit]")).toHaveCount(0);
    await expect(page.locator("[data-portal-member-receipt-back-trips]")).toBeVisible();

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-01-awaiting-approval.png");
  });

  test("BOOK-BQC-01A refresh, back/forward, and a second tab keep one booking consistent", async ({
    page,
  }) => {
    const contact = uniqueContact("book-bqc-01a");
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: "BOOK BQC 01A History",
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });
    await openMemberRegistrationsFromSuccess(page);
    await expect(
      page.locator("[data-portal-member-registrations-list] a").filter({
        hasText: OPERATOR_PUBLISHED_TOUR_TITLE,
      })
    ).toHaveCount(1);

    await openMemberRegistrationDetailById(page, registrationId);
    const detailUrl = new RegExp(`/me/registrations/${registrationId}(?:\\?.*)?$`);
    await expect(page).toHaveURL(detailUrl);
    await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible({
      timeout: 60_000,
    });

    const secondTab = await page.context().newPage();
    try {
      await secondTab.goto(`/me/registrations/${registrationId}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(secondTab.locator("[data-portal-member-registration-detail]")).toBeVisible({
        timeout: 60_000,
      });
      await expect(
        secondTab.locator("[data-portal-member-receipt-awaiting-approval]")
      ).toBeVisible();
      await secondTab.reload({ waitUntil: "domcontentloaded" });
      await expect(secondTab.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible(
        { timeout: 60_000 }
      );

      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/me\/registrations$/);
      await expect(
        page.locator("[data-portal-member-registrations-list] a").filter({
          hasText: OPERATOR_PUBLISHED_TOUR_TITLE,
        })
      ).toHaveCount(1);
      await page.goForward({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(detailUrl);
      await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();

      const registrations = await fetchMemberRegistrationId(page, {
        tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
      });
      expect(registrations).toBe(registrationId);
    } finally {
      await secondTab.close();
    }
  });

  test("BOOK-BQC-02 operator approve unlocks member receipt upload form", async ({
    page,
    browser,
  }) => {
    const contact = uniqueContact("book-bqc-02");
    const guestName = "BOOK BQC 02 Approved";
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: guestName,
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorApproveBookingViaUi(operatorPage, {
        guestLabel: guestName,
        bookingId: registrationId,
      });
    });

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-submit]")).toBeVisible();
    await expect(page.locator("#receipt-file")).toBeVisible();
    await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-02-upload-unlocked.png");
  });

  test("BOOK-BQC-03 operator reject shows closed registration to member", async ({
    page,
    browser,
  }) => {
    const contact = uniqueContact("book-bqc-03");
    const guestName = "BOOK BQC 03 Rejected";
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: guestName,
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorRejectBookingViaUi(operatorPage, {
        guestLabel: guestName,
        bookingId: registrationId,
      });
    });

    await openMemberRegistrationDetailById(page, registrationId);
    const closed = page.locator("[data-portal-member-receipt-closed]");
    await expect(closed).toBeVisible({ timeout: 60_000 });
    await expect(closed).toHaveAttribute("data-closed-reason", "rejected");
    await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-03-rejected-closed.png");
  });

  test("BOOK-BQC-04 member receipt upload enters waiting-for-review state", async ({
    page,
    browser,
  }) => {
    const contact = uniqueContact("book-bqc-04");
    const guestName = "BOOK BQC 04 Receipt";
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: guestName,
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorApproveBookingViaUi(operatorPage, {
        guestLabel: guestName,
        bookingId: registrationId,
      });
    });

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });

    await attachMemberReceiptFile(page);
    await submitMemberReceiptUpload(page, registrationId);

    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-04-receipt-waiting.png");
  });

  test("BOOK-BQC-05 approved receipt state persists after reload", async ({ page, browser }) => {
    const contact = uniqueContact("book-bqc-05");
    const guestName = "BOOK BQC 05 Persist";
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: guestName,
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorApproveBookingViaUi(operatorPage, {
        guestLabel: guestName,
        bookingId: registrationId,
      });
    });

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });

    await attachMemberReceiptFile(page);
    await submitMemberReceiptUpload(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-05-persist-after-reload.png");
  });

  test("BOOK-BQC-06 rejected receipt can be corrected and resubmitted", async ({
    page,
    browser,
  }) => {
    const contact = uniqueContact("book-bqc-06");
    const guestName = "BOOK BQC 06 Receipt Resubmit";
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: guestName,
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorApproveBookingViaUi(operatorPage, {
        guestLabel: guestName,
        bookingId: registrationId,
      });
    });

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await page.locator("#receipt-file").setInputFiles({
      name: "bqc-receipt-first.png",
      mimeType: "image/png",
      buffer: minimalReceiptPngBuffer(),
    });
    const firstReceipt = await submitMemberReceiptUpload(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });
    expect(firstReceipt.id).toBeTruthy();
    await withOperatorBookingsUi(browser, async (operatorPage) => {
      const rejected = await operatorPage.request.patch(
        `/api/finance/receipts/${encodeURIComponent(firstReceipt.id!)}/review`,
        { data: { decision: "reject", reviewNote: "BQC rejected receipt correction path" } }
      );
      expect(rejected.ok(), await rejected.text()).toBeTruthy();
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-receipt-rejected-hint]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
    await page.locator("#receipt-file").setInputFiles({
      name: "bqc-receipt-resubmitted.png",
      mimeType: "image/png",
      buffer: minimalReceiptPngBuffer(),
    });
    await submitMemberReceiptUpload(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-rejected-hint]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-06-receipt-resubmit.png");
  });

  test("BOOK-BQC-07 booking reaches final approval across member, admin, and roster", async ({
    page,
    browser,
  }) => {
    const contact = uniqueContact("book-bqc-07");
    const guestName = "BOOK BQC 07 Finalized";
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: guestName,
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });
    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorApproveBookingViaUi(operatorPage, {
        guestLabel: guestName,
        bookingId: registrationId,
      });
    });

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await page.locator("#receipt-file").setInputFiles({
      name: "bqc-finalized-receipt.png",
      mimeType: "image/png",
      buffer: minimalReceiptPngBuffer(),
    });
    const receipt = await submitMemberReceiptUpload(page, registrationId);
    expect(receipt.id, "member receipt submission must return its receipt id").toBeTruthy();
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorPage.goto(
        `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
        { waitUntil: "domcontentloaded" }
      );
      await expect(operatorPage.getByTestId("finance-receipts-panel")).toBeVisible({
        timeout: 60_000,
      });
      const receiptRow = operatorPage
        .getByTestId("finance-receipts-list")
        .getByRole("listitem")
        .filter({ has: operatorPage.locator(`a[title="${registrationId}"]`) });
      const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
      await expect(reviewForm).toBeVisible({ timeout: 60_000 });

      const approveResponse = operatorPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes(`/api/finance/receipts/${receipt.id}/review`)
      );
      await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
      const approved = await approveResponse;
      expect(approved.ok(), await approved.text()).toBeTruthy();
      await expect(receiptRow).toHaveCount(0, { timeout: 60_000 });

      await operatorPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
      const bookingRow = operatorPage.locator("[data-booking-row]").filter({ hasText: guestName });
      await expect(bookingRow).toBeVisible({ timeout: 60_000 });
      await expect(bookingRow.getByTestId("operator-bookings-payment-badge-inbox")).toHaveAttribute(
        "data-payment-status",
        "paid"
      );

      const finalizeResponse = await operatorPage.request.post(
        `/api/bookings/${encodeURIComponent(registrationId)}/finalize`
      );
      expect(finalizeResponse.ok(), await finalizeResponse.text()).toBeTruthy();

      const rosterResponse = await operatorPage.request.get(
        `/api/tours/${encodeURIComponent(OPERATOR_PUBLISHED_TOUR_ID)}/operational-roster?filter=final&view=ops`
      );
      expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
      const roster = (await rosterResponse.json()) as {
        items?: Array<{
          registrationId?: string;
          finalizationStatus?: string;
          financialDisplayState?: string;
        }>;
        data?: {
          items?: Array<{
            registrationId?: string;
            finalizationStatus?: string;
            financialDisplayState?: string;
          }>;
        };
      };
      const rosterRow = (roster.items ?? roster.data?.items ?? []).find(
        (item) => item.registrationId === registrationId
      );
      expect(rosterRow).toMatchObject({
        registrationId,
        finalizationStatus: "finalized",
        financialDisplayState: "PAID",
      });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible();
    await expect(page.locator("[data-portal-member-detail-status-copy]")).toContainText(
      "سفر شما نهایی شده است"
    );

    await expect(page.locator("[data-portal-member-cancel-submit]")).toBeVisible({
      timeout: 60_000,
    });
    await page.locator("[data-portal-member-cancel-submit]").click();
    await expect(page.locator("[data-portal-member-cancel-pending]")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-cancel-pending]")).toBeVisible({
      timeout: 60_000,
    });

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
      const queue = operatorPage.getByTestId("member-cancellation-queue");
      await expect(queue).toContainText(registrationId, { timeout: 60_000 });
      await expect(queue.getByRole("link", { name: new RegExp(registrationId) })).toHaveAttribute(
        "href",
        `/bookings?bookingId=${registrationId}`
      );
      await queue.getByRole("button", { name: /رد درخواست|reject request/i }).click();
      await expect(queue).not.toContainText(registrationId, { timeout: 60_000 });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-cancel-rejected]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible();

    await page.locator("[data-portal-member-cancel-submit]").click();
    await expect(page.locator("[data-portal-member-cancel-pending]")).toBeVisible();
    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
      const queue = operatorPage.getByTestId("member-cancellation-queue");
      await expect(queue).toContainText(registrationId, { timeout: 60_000 });
      const approvalResponse = operatorPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes(`/api/bookings/${registrationId}/member-cancellation/approve`)
      );
      await queue.getByRole("button", { name: /تأیید لغو|approve cancellation/i }).click();
      const approvedCancellation = await approvalResponse;
      expect(approvedCancellation.ok(), await approvedCancellation.text()).toBeTruthy();
      const outcome = (await approvedCancellation.json()) as {
        kind?: string;
        status?: string;
        refundStatus?: string;
      };
      expect(outcome).toMatchObject({
        kind: "cancelled",
        status: "cancelled",
        refundStatus: "pending_finance_approval",
      });
      await expect(queue).not.toContainText(registrationId, { timeout: 60_000 });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-detail-status-card]")).toHaveAttribute(
      "data-status-tone",
      "closed"
    );
    await expect(page.locator("[data-portal-member-detail-status-copy]")).toContainText(
      "ثبت‌نام شما بسته شده است"
    );
  });
});
