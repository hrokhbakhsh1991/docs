/**
 * BOOK-BQC — portal tour purchase path under different registration/payment states.
 * Member steps are real browser E2E; operator approve/reject uses API (partial realness).
 */
import { expect, test } from "@playwright/test";

import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";
import {
  OPERATOR_PUBLISHED_TOUR_TITLE,
  completePortalCatalogRegistration,
} from "./fixtures/complete-portal-registration";
import {
  createOperatorBookingApiContext,
  operatorApproveBooking,
  operatorRejectBooking,
} from "./fixtures/operator-booking-api";
import {
  fetchMemberRegistrationId,
  minimalReceiptPngBuffer,
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
  test("BOOK-BQC-01 fresh catalog registration awaits club approval", async ({ page }) => {
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

  test("BOOK-BQC-02 operator approve unlocks member receipt upload form", async ({ page }) => {
    const contact = uniqueContact("book-bqc-02");
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: "BOOK BQC 02 Approved",
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    const operatorApi = await createOperatorBookingApiContext();
    await operatorApproveBooking(operatorApi, registrationId);
    await operatorApi.dispose();

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-submit]")).toBeVisible();
    await expect(page.locator("#receipt-file")).toBeVisible();
    await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-02-upload-unlocked.png");
  });

  test("BOOK-BQC-03 operator reject shows closed registration to member", async ({ page }) => {
    const contact = uniqueContact("book-bqc-03");
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: "BOOK BQC 03 Rejected",
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    const operatorApi = await createOperatorBookingApiContext();
    await operatorRejectBooking(operatorApi, registrationId, {
      reason: "BOOK-BQC-03 smoke rejection",
    });
    await operatorApi.dispose();

    await openMemberRegistrationDetailById(page, registrationId);
    const closed = page.locator("[data-portal-member-receipt-closed]");
    await expect(closed).toBeVisible({ timeout: 60_000 });
    await expect(closed).toHaveAttribute("data-closed-reason", "rejected");
    await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-03-rejected-closed.png");
  });

  test("BOOK-BQC-04 member receipt upload enters waiting-for-review state", async ({ page }) => {
    const contact = uniqueContact("book-bqc-04");
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: "BOOK BQC 04 Receipt",
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    const operatorApi = await createOperatorBookingApiContext();
    await operatorApproveBooking(operatorApi, registrationId);
    await operatorApi.dispose();

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });

    const fileInput = page.locator("#receipt-file");
    await fileInput.setInputFiles({
      name: "bqc-receipt.png",
      mimeType: "image/png",
      buffer: minimalReceiptPngBuffer(),
    });

    const [uploadResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes(`/api/me/registrations/${registrationId}/receipt`),
        { timeout: 90_000 },
      ),
      page.locator("[data-portal-member-receipt-submit]").click(),
    ]);
    expect(uploadResponse.ok(), await uploadResponse.text()).toBeTruthy();

    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-04-receipt-waiting.png");
  });

  test("BOOK-BQC-05 approved receipt state persists after reload", async ({ page }) => {
    const contact = uniqueContact("book-bqc-05");
    await completePortalCatalogRegistration(page, {
      email: contact.email,
      fullName: "BOOK BQC 05 Persist",
      phone: contact.phone,
    });

    const registrationId = await fetchMemberRegistrationId(page, {
      tourTitle: OPERATOR_PUBLISHED_TOUR_TITLE,
    });

    const operatorApi = await createOperatorBookingApiContext();
    await operatorApproveBooking(operatorApi, registrationId);
    await operatorApi.dispose();

    await openMemberRegistrationDetailById(page, registrationId);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-booking-05-persist-after-reload.png");
  });
});
