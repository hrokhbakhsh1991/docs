/** Current-SHA staging proof for operator cancellation and manual waitlist promotion. */
import { expect, test, type Page } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import {
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
  completePortalRegistrationForTour,
} from "../../test/fixtures/tour-creation-closure-fixture";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

async function registerAndReadId(
  page: Page,
  tourId: string,
  title: string,
  phone: string,
  fullName: string
): Promise<string> {
  await completePortalRegistrationForTour(page, tourId, { phone, fullName });
  await page.goto(`${PORTAL_OPERATOR_BASE_URL}/me/registrations`, {
    waitUntil: "domcontentloaded",
  });
  const link = page
    .locator("[data-portal-member-registrations-list] a")
    .filter({ hasText: title })
    .first();
  await expect(link).toBeVisible({ timeout: 60_000 });
  const href = await link.getAttribute("href");
  const id = href?.match(/\/me\/registrations\/([^/?#]+)/)?.[1];
  expect(id, `member registration id for ${fullName}`).toBeTruthy();
  return id!;
}

test("TC-CL-WAITLIST-CANCEL-01 operator cancellation releases a seat without auto-promotion", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const title = `TC-CL manual waitlist cancel ${stamp}`;
  const firstName = `Waitlist Seat Holder ${String(stamp).slice(-7)}`;
  const secondName = `Waitlist Next ${String(stamp).slice(-7)}`;
  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 1,
    pricing: { paymentCollection: "free", registrationApproval: "manual" },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  expect(canonical.pricing).toBeTruthy();

  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstMemberPage = await firstContext.newPage();
  const secondMemberPage = await secondContext.newPage();
  try {
    const firstId = await registerAndReadId(
      firstMemberPage,
      tourId,
      title,
      `+1555${String(stamp).slice(-7)}`,
      firstName
    );
    const initialBookingResponse = await page.request.get(`/api/bookings/${firstId}`);
    expect(initialBookingResponse.ok(), await initialBookingResponse.text()).toBeTruthy();
    const initialBooking = (await initialBookingResponse.json()) as { status?: string };
    expect(initialBooking.status).toBe("pending");
    const firstApprovalResponse = await page.request.post(`/api/bookings/${firstId}/approve`);
    expect(firstApprovalResponse.ok(), await firstApprovalResponse.text()).toBeTruthy();

    const firstBookingResponse = await page.request.get(`/api/bookings/${firstId}`);
    expect(firstBookingResponse.ok(), await firstBookingResponse.text()).toBeTruthy();
    const firstBooking = (await firstBookingResponse.json()) as {
      status?: string;
      paymentStatus?: string;
    };
    expect(firstBooking).toMatchObject({ status: "approved" });

    const waitlistedId = await registerAndReadId(
      secondMemberPage,
      tourId,
      title,
      `+1555${String(stamp + 1).slice(-7)}`,
      secondName
    );
    console.log(
      `TC-CL-WAITLIST-CANCEL-01 synthetic ids: tour=${tourId} cancelledBooking=${firstId} waitlistedBooking=${waitlistedId}`
    );
    const waitlistedBeforeResponse = await page.request.get(`/api/bookings/${waitlistedId}`);
    expect(waitlistedBeforeResponse.ok(), await waitlistedBeforeResponse.text()).toBeTruthy();
    const waitlistedBefore = (await waitlistedBeforeResponse.json()) as {
      status?: string;
      paymentStatus?: string;
    };
    expect(waitlistedBefore.status).toBe("waitlisted");

    await withOperatorBookingsUi(browser, async (adminPage) => {
      await adminPage.goto(`/bookings?status=all&bookingId=${encodeURIComponent(firstId)}`, {
        waitUntil: "domcontentloaded",
      });
      const inspection = adminPage.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
      await expect(inspection).toBeVisible({ timeout: 60_000 });
      const cancelButton = inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelButton);
      await expect(cancelButton).toBeEnabled({ timeout: 30_000 });
      const cancelResponse = adminPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/bookings/${firstId}/cancel`) &&
          response.request().method() === "POST"
      );
      await cancelButton.click();
      const dialog = adminPage.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelConfirmDialog);
      await expect(dialog).toBeVisible();
      await dialog.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelConfirmButton).click();
      const cancelledResponse = await cancelResponse;
      expect(cancelledResponse.status(), await cancelledResponse.text()).toBe(200);

      const cancelledRes = await adminPage.request.get(`/api/bookings/${firstId}`);
      expect(cancelledRes.ok(), await cancelledRes.text()).toBeTruthy();
      const cancelled = (await cancelledRes.json()) as {
        status?: string;
        cancellationStatus?: string;
      };
      expect(cancelled).toMatchObject({ status: "cancelled", cancellationStatus: "applied" });

      const stillWaitingRes = await adminPage.request.get(`/api/bookings/${waitlistedId}`);
      expect(stillWaitingRes.ok(), await stillWaitingRes.text()).toBeTruthy();
      const stillWaiting = (await stillWaitingRes.json()) as { status?: string };
      expect(stillWaiting.status).toBe("waitlisted");

      const rosterRes = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(rosterRes.ok(), await rosterRes.text()).toBeTruthy();
      const roster = (await rosterRes.json()) as {
        items?: readonly { id?: string; guestLabel?: string; status?: string }[];
      };
      expect((roster.items ?? []).find((row) => row.id === firstId)?.status).toBe("cancelled");
      expect((roster.items ?? []).find((row) => row.id === waitlistedId)?.status).toBe(
        "waitlisted"
      );

      // This is the explicit operator decision that admits the next guest after
      // the cancellation opened one seat; no payment or receipt is involved.
      const promoteRes = await adminPage.request.post(`/api/bookings/${waitlistedId}/approve`);
      expect(promoteRes.ok(), await promoteRes.text()).toBeTruthy();
      const promotedRes = await adminPage.request.get(`/api/bookings/${waitlistedId}`);
      expect(promotedRes.ok(), await promotedRes.text()).toBeTruthy();
      const promoted = (await promotedRes.json()) as { status?: string; paymentStatus?: string };
      expect(promoted.status).toBe("approved");

      const finalRosterRes = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(finalRosterRes.ok(), await finalRosterRes.text()).toBeTruthy();
      const finalRoster = (await finalRosterRes.json()) as {
        items?: readonly { id?: string; guestLabel?: string; status?: string }[];
      };
      expect((finalRoster.items ?? []).find((row) => row.id === waitlistedId)).toMatchObject({
        guestLabel: secondName,
        status: "approved",
      });
    });

    await secondMemberPage.goto(
      `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(waitlistedId)}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(secondMemberPage.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      secondMemberPage.locator("[data-portal-member-detail-status-badge]")
    ).toContainText(/تأیید شده|approved/i, { timeout: 60_000 });
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
