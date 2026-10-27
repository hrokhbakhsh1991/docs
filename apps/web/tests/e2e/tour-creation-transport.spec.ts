/** BQC — focused staging proof for bus member intake and operator roster mapping. */
import { expect, test } from "@playwright/test";

import {
  completePortalRegistrationForTour,
  fetchMarketingCatalogTour,
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
  readCanonicalBasePriceMinor,
} from "../../test/fixtures/tour-creation-closure-fixture";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

const transportMode = process.env.TOUR_TRANSPORT_MODE === "train" ? ("train" as const) : "bus";

test(`TC-CL-TRANSPORT-${transportMode.toUpperCase()}-01 member intake reaches portal and operator roster`, async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const title = `TC-CL-TRANSPORT ${transportMode} ${stamp}`;
  const guestName = `${transportMode} Member ${String(stamp).slice(-6)}`;
  const phone = `+1555${String(stamp).slice(-7)}`;
  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 2,
    pricing: { paymentCollection: "free", registrationApproval: "auto" },
    transport: {
      mode: transportMode,
      allowPersonalCar: false,
      ...(transportMode === "train" ? { seatPreference: "پنجره" } : {}),
    },
  });

  expect(canonical.transport).toMatchObject({ mode: transportMode });
  expect(readCanonicalBasePriceMinor(canonical)).toBeNull();
  const catalogTour = await fetchMarketingCatalogTour(page, tourId);
  expect(catalogTour.transport?.mode).toBe(transportMode);
  expect(catalogTour.transport?.allowPersonalCar).not.toBe(true);

  const registrationPost = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/api/catalog/registrations"),
    { timeout: 90_000 }
  );
  await completePortalRegistrationForTour(page, tourId, { phone, fullName: guestName });
  const registrationBody = JSON.parse((await registrationPost).postData() ?? "{}") as {
    transport?: { kind?: string };
  };
  // This variant has no personal-car follow-up, so organized transport is primary.
  expect(registrationBody.transport?.kind).toBe("primary");

  await page.goto(`${PORTAL_OPERATOR_BASE_URL}/me/registrations`, {
    waitUntil: "domcontentloaded",
  });
  const detailLink = page
    .locator("[data-portal-member-registrations-list] a")
    .filter({ hasText: title })
    .first();
  await expect(detailLink).toBeVisible({ timeout: 60_000 });
  const href = await detailLink.getAttribute("href");
  const registrationId = href?.match(/\/me\/registrations\/([^/?#]+)/)?.[1];
  expect(registrationId).toBeTruthy();
  await page.goto(`${PORTAL_OPERATOR_BASE_URL}${href}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
    timeout: 60_000,
  });
  const memberResponse = await page.request.get(
    `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId!)}`
  );
  expect(memberResponse.ok(), await memberResponse.text()).toBeTruthy();
  expect(((await memberResponse.json()) as { data?: { status?: string } }).data?.status).toBe(
    "approved"
  );

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as {
      items?: readonly {
        id?: string;
        guestLabel?: string;
        status?: string;
        transportKind?: string | null;
      }[];
    };
    expect((roster.items ?? []).find((row) => row.id === registrationId)).toMatchObject({
      guestLabel: expect.stringContaining(guestName),
      status: "approved",
      transportKind: "primary",
    });
  });
});
