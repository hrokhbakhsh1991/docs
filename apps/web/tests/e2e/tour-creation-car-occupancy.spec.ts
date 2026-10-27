/** Focused staging proof for all bus-tour personal-car occupant choices. */
import { expect, test } from "@playwright/test";

import {
  completePortalRegistrationForTour,
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

test("TC-CL-TRANSPORT-CAR-01 bus tour persists personal-car occupant choices 0 through 3", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const title = `TC-CL-TRANSPORT car occupancy ${stamp}`;
  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 8,
    pricing: { paymentCollection: "free", registrationApproval: "auto" },
    transport: { mode: "bus", allowPersonalCar: true, dongAmountToman: "100" },
  });
  expect(canonical.transport).toMatchObject({ mode: "bus", allowPersonalCar: true });

  const registrations: Array<{ id: string; name: string; occupants: number }> = [];
  for (const occupants of [0, 1, 2, 3] as const) {
    const sequence = registrations.length;
    const phone = `+1555${String(stamp + sequence).slice(-7)}`;
    const name = `Car Occupancy ${occupants} ${String(stamp).slice(-6)}`;
    const registrationPage = await browser.newPage();
    try {
      const submissionPromise = registrationPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith("/api/catalog/registrations"),
        { timeout: 90_000 }
      );
      await completePortalRegistrationForTour(registrationPage, tourId, {
        phone,
        fullName: name,
        transportChoice: "personal_car",
        personalCarOccupants: occupants,
      });

      const submission = await submissionPromise;
      const responseText = await submission.text();
      expect(
        submission.ok(),
        `registration ${occupants} failed (${submission.status()})`
      ).toBeTruthy();
      const requestBody = JSON.parse(submission.request().postData() ?? "{}") as {
        transport?: { kind?: string; personalCarOccupants?: number };
      };
      expect(requestBody.transport).toMatchObject({
        kind: "personal_car",
        personalCarOccupants: occupants,
      });
      const responseBody = JSON.parse(responseText) as { registrationId?: unknown };
      expect(typeof responseBody.registrationId).toBe("string");
      registrations.push({
        id: responseBody.registrationId as string,
        name,
        occupants,
      });

      await registrationPage.goto(
        `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(responseBody.registrationId as string)}`,
        { waitUntil: "domcontentloaded" }
      );
      await expect(
        registrationPage.locator("[data-portal-member-registration-detail]")
      ).toBeVisible({ timeout: 60_000 });
    } finally {
      await registrationPage.close();
    }
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const response = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const roster = (await response.json()) as {
      items?: readonly {
        id?: string;
        guestLabel?: string;
        status?: string;
        transportKind?: string | null;
        personalCarOccupants?: number | null;
      }[];
    };
    for (const registration of registrations) {
      expect((roster.items ?? []).find((item) => item.id === registration.id)).toMatchObject({
        guestLabel: expect.stringContaining(registration.name),
        status: "approved",
        transportKind: "personal_car",
        personalCarOccupants: registration.occupants,
      });
    }
  });
});
