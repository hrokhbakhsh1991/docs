/** Current-artifact staging proof for free registrations under both approval policies. */
import { expect, test, type Page } from "@playwright/test";

import {
  completePortalRegistrationForTour,
  fetchMarketingCatalogTour,
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";
import {
  operatorApproveBookingViaUi,
  withOperatorBookingsUi,
} from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

async function readMemberStatus(page: Page, registrationId: string): Promise<string | undefined> {
  const response = await page.request.get(
    `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId)}`
  );
  expect(response.ok(), `member read failed (${response.status()})`).toBeTruthy();
  const body = (await response.json()) as { data?: { status?: string } };
  return body.data?.status;
}

for (const approval of ["manual", "auto"] as const) {
  test(`TC-CL-FREE-${approval.toUpperCase()}-01 free registration agrees across member, roster and capacity`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const title = `TC-CL free ${approval} ${stamp}`;
    const guestName = `Free ${approval} ${String(stamp).slice(-6)}`;
    const phone = `+1555${String(stamp).slice(-7)}`;
    const { tourId } = await publishTourForClosure(page, title, {
      capacityMax: 3,
      pricing: { paymentCollection: "free", registrationApproval: approval },
    });
    // Free tours intentionally omit public priceAmount instead of exposing zero.
    expect((await fetchMarketingCatalogTour(page, tourId)).priceAmount).toBeNull();

    await completePortalRegistrationForTour(page, tourId, { phone, fullName: guestName });
    await page.goto(`${PORTAL_OPERATOR_BASE_URL}/me/registrations`, {
      waitUntil: "domcontentloaded",
    });
    const memberLink = page
      .locator("[data-portal-member-registrations-list] a")
      .filter({ hasText: title })
      .first();
    await expect(memberLink).toBeVisible({ timeout: 60_000 });
    const href = await memberLink.getAttribute("href");
    const registrationId = href?.match(/\/me\/registrations\/([^/?#]+)/)?.[1];
    expect(registrationId).toBeTruthy();

    const expectedInitial = approval === "manual" ? "pending" : "approved";
    await expect.poll(() => readMemberStatus(page, registrationId!)).toBe(expectedInitial);

    await withOperatorBookingsUi(browser, async (operatorPage) => {
      const rosterResponse = await operatorPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
      const roster = (await rosterResponse.json()) as {
        items?: readonly { id?: string; guestLabel?: string; status?: string }[];
      };
      const row = (roster.items ?? []).find((item) => item.id === registrationId);
      expect(row?.guestLabel).toContain(guestName);
      expect(row?.status).toBe(expectedInitial);
      expect((roster.items ?? []).filter((item) => item.id === registrationId)).toHaveLength(1);

      const detailResponse = await operatorPage.request.get(`/api/bookings/${registrationId}`);
      expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy();
      const detail = (await detailResponse.json()) as {
        capacitySnapshot?: { occupied?: number; max?: number };
      };
      expect(detail.capacitySnapshot).toEqual({
        occupied: approval === "manual" ? 0 : 1,
        max: 3,
      });

      if (approval === "manual") {
        await operatorApproveBookingViaUi(operatorPage, {
          guestLabel: guestName,
          bookingId: registrationId!,
        });
        await expect.poll(() => readMemberStatus(page, registrationId!)).toBe("approved");
        const approvedRosterResponse = await operatorPage.request.get(
          `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
        );
        expect(approvedRosterResponse.ok(), await approvedRosterResponse.text()).toBeTruthy();
        const approvedRoster = (await approvedRosterResponse.json()) as {
          items?: readonly { id?: string; status?: string }[];
        };
        expect(approvedRoster.items?.find((item) => item.id === registrationId)?.status).toBe(
          "approved"
        );
        const approvedDetailResponse = await operatorPage.request.get(
          `/api/bookings/${registrationId}`
        );
        expect(approvedDetailResponse.ok(), await approvedDetailResponse.text()).toBeTruthy();
        const approvedDetail = (await approvedDetailResponse.json()) as {
          capacitySnapshot?: { occupied?: number; max?: number };
        };
        expect(approvedDetail.capacitySnapshot).toEqual({ occupied: 1, max: 3 });
      }
    });
  });
}
