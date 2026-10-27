/** Current-SHA member cancellation request, rejection, resubmission, and approval proof. */
import { expect, test } from "@playwright/test";

import {
  attachMemberReceiptFile,
  fetchMemberRegistrationId,
  submitMemberReceiptUpload,
} from "../../../portal/tests/e2e/fixtures/portal-member-registration-api";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";
import {
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
  completePortalRegistrationForTour,
  fetchMarketingCatalogTour,
} from "../../test/fixtures/tour-creation-closure-fixture";

test("TC-CL-MEMBER-CANCEL-01 request survives refresh, reject preserves seat, resubmit and approve releases it", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const title = `TC-CL member cancellation ${stamp}`;
  const fullName = `Synthetic Cancel ${String(stamp).slice(-7)}`;
  const phone = `+1555${String(stamp).slice(-7).padStart(7, "0")}`;
  const { tourId } = await publishTourForClosure(page, title, {
    capacityMax: 4,
    pricing: { paymentCollection: "paid", registrationApproval: "auto", basePriceToman: "1000" },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  console.log(`TC-CL-MEMBER-CANCEL checkpoint=published tour=${tourId}`);

  const memberContext = await browser.newContext({ baseURL: PORTAL_OPERATOR_BASE_URL });
  const memberPage = await memberContext.newPage();
  try {
    await completePortalRegistrationForTour(memberPage, tourId, { phone, fullName });
    const registrationId = await fetchMemberRegistrationId(memberPage, { tourTitle: title });
    console.log(`TC-CL-MEMBER-CANCEL checkpoint=registered booking=${registrationId}`);

    await memberPage.goto(`/me/registrations/${registrationId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(memberPage.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await attachMemberReceiptFile(memberPage);
    const receipt = await submitMemberReceiptUpload(memberPage, registrationId);
    expect(receipt.id).toBeTruthy();
    console.log(`TC-CL-MEMBER-CANCEL checkpoint=receipt-uploaded receipt=${receipt.id}`);

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      await operatorPage.goto(
        `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
        { waitUntil: "domcontentloaded" }
      );
      const panel = operatorPage.getByTestId("finance-receipts-panel");
      await expect(panel).toBeVisible({ timeout: 60_000 });
      const row = operatorPage
        .getByTestId("finance-receipts-list")
        .getByRole("listitem")
        .filter({ has: operatorPage.locator(`a[title="${registrationId}"]`) });
      const reviewForm = row.getByTestId("finance-receipt-review-form");
      await expect(reviewForm).toBeVisible({ timeout: 60_000 });
      const approved = operatorPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes(`/api/finance/receipts/${receipt.id}/review`)
      );
      await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
      expect((await approved).ok()).toBeTruthy();
    });
    console.log("TC-CL-MEMBER-CANCEL checkpoint=receipt-approved-no-gateway");
    const occupiedCatalog = await fetchMarketingCatalogTour(page, tourId);
    const occupiedSpots = Number((occupiedCatalog as { spotsRemaining?: unknown }).spotsRemaining);
    expect(Number.isFinite(occupiedSpots)).toBe(true);
    console.log(
      `TC-CL-MEMBER-CANCEL checkpoint=paid-booking-capacity-baseline spots=${occupiedSpots}`
    );

    await memberPage.reload({ waitUntil: "domcontentloaded" });
    await expect(memberPage.locator("[data-portal-member-receipt-paid]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(memberPage.locator("[data-portal-member-cancel-submit]")).toBeVisible({
      timeout: 60_000,
    });
    await memberPage.locator("[data-portal-member-cancel-submit]").click();
    await expect(memberPage.locator("[data-portal-member-cancel-pending]")).toBeVisible({
      timeout: 60_000,
    });
    console.log("TC-CL-MEMBER-CANCEL checkpoint=request-persisted-after-refresh");
    await memberPage.reload({ waitUntil: "domcontentloaded" });
    await expect(memberPage.locator("[data-portal-member-cancel-pending]")).toBeVisible({
      timeout: 60_000,
    });

    const bookingEndpoint = `/api/bookings/${encodeURIComponent(registrationId)}`;
    const afterRequest = await page.request.get(bookingEndpoint);
    expect(afterRequest.ok(), await afterRequest.text()).toBeTruthy();
    expect(await afterRequest.json()).toMatchObject({
      status: "approved",
      cancellationStatus: "request_pending",
    });
    const afterRequestCatalog = await fetchMarketingCatalogTour(page, tourId);
    expect((afterRequestCatalog as { spotsRemaining?: number }).spotsRemaining).toBe(occupiedSpots);

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      const queueResponse = await operatorPage.request.get(
        "/api/bookings/member-cancellation-requests?status=pending"
      );
      expect(queueResponse.ok(), await queueResponse.text()).toBeTruthy();
      const pending = (await queueResponse.json()) as { items?: { id?: string }[] };
      expect(pending.items?.some((item) => item.id === registrationId)).toBe(true);
      console.log("TC-CL-MEMBER-CANCEL checkpoint=operator-queue-api-visible");
      const reject = await operatorPage.request.post(
        `/api/bookings/${encodeURIComponent(registrationId)}/member-cancellation/reject`
      );
      expect(reject.ok(), await reject.text()).toBeTruthy();
      console.log("TC-CL-MEMBER-CANCEL checkpoint=reject-api-ok");
    });

    await memberPage.reload({ waitUntil: "domcontentloaded" });
    await expect(memberPage.locator("[data-portal-member-cancel-rejected]")).toBeVisible({
      timeout: 60_000,
    });
    const rejectedCatalog = await fetchMarketingCatalogTour(page, tourId);
    expect((rejectedCatalog as { spotsRemaining?: number }).spotsRemaining).toBe(occupiedSpots);
    const rejectedBookingResponse = await page.request.get(bookingEndpoint);
    expect(rejectedBookingResponse.ok(), await rejectedBookingResponse.text()).toBeTruthy();
    const rejectedBooking = (await rejectedBookingResponse.json()) as {
      status?: string;
      cancellationStatus?: string;
      paymentStatus?: string;
    };
    expect(rejectedBooking).toMatchObject({ status: "approved", cancellationStatus: "rejected" });
    expect(rejectedBooking.paymentStatus).toBe("paid");
    console.log("TC-CL-MEMBER-CANCEL checkpoint=rejected-paid-and-capacity-unchanged");

    await memberPage.locator("[data-portal-member-cancel-submit]").click();
    await expect(memberPage.locator("[data-portal-member-cancel-pending]")).toBeVisible({
      timeout: 60_000,
    });
    await withOperatorBookingsUi(browser, async (operatorPage) => {
      const queueResponse = await operatorPage.request.get(
        "/api/bookings/member-cancellation-requests?status=pending"
      );
      expect(queueResponse.ok(), await queueResponse.text()).toBeTruthy();
      const pending = (await queueResponse.json()) as { items?: { id?: string }[] };
      expect(pending.items?.some((item) => item.id === registrationId)).toBe(true);
      console.log("TC-CL-MEMBER-CANCEL checkpoint=resubmitted-queue-api-visible");
      const response = await operatorPage.request.post(
        `/api/bookings/${encodeURIComponent(registrationId)}/member-cancellation/approve`
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      const approval = (await response.json()) as {
        kind?: string;
        status?: string;
        refundStatus?: string;
      };
      expect(approval).toMatchObject({ kind: "cancelled", status: "cancelled" });
      console.log(
        `TC-CL-MEMBER-CANCEL checkpoint=approve-api-ok refundStatus=${approval.refundStatus}`
      );
      const booking = await operatorPage.request.get(bookingEndpoint);
      expect(booking.ok(), await booking.text()).toBeTruthy();
      const bookingBody = (await booking.json()) as {
        status?: string;
        cancellationStatus?: string;
        paymentStatus?: string;
        capacitySnapshot?: { occupied?: number; max?: number };
      };
      expect(bookingBody).toMatchObject({
        status: "cancelled",
        cancellationStatus: "applied",
        capacitySnapshot: { occupied: 0, max: 4 },
      });
      expect(bookingBody.paymentStatus).toBe("paid");
      const rosterResponse = await operatorPage.request.get(
        `/api/bookings?tourId=${tourId}&view=ops&limit=20`
      );
      expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
      const roster = (await rosterResponse.json()) as {
        items?: { id?: string; status?: string }[];
      };
      expect(roster.items?.find((item) => item.id === registrationId)?.status).toBe("cancelled");
      console.log("TC-CL-MEMBER-CANCEL checkpoint=cancelled-roster-visible-payment-paid");
    });

    await memberPage.reload({ waitUntil: "domcontentloaded" });
    await expect(memberPage.locator("[data-portal-member-detail-status-card]")).toHaveAttribute(
      "data-status-tone",
      "closed",
      { timeout: 60_000 }
    );
    const finalCatalog = await fetchMarketingCatalogTour(page, tourId);
    const finalCapacity = finalCatalog as { totalCapacity?: number; spotsRemaining?: number };
    expect(finalCapacity.spotsRemaining).toBe(finalCapacity.totalCapacity);
    console.log("TC-CL-MEMBER-CANCEL checkpoint=portal-closed-capacity-released");
    console.log(
      `TC-CL-MEMBER-CANCEL-01 synthetic ids: tour=${tourId} booking=${registrationId} receipt=${receipt.id}`
    );
  } finally {
    await memberContext.close();
  }
});
