/** Current-SHA staging boundary: a dong registration cannot outrun offered car seats. */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import {
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

test("TC-CL-VEHICLE-NO-CAR-01 rejects dong registration when no car seats are offered", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const title = `TC-CL-VEHICLE no-car dong ${stamp}`;
  const fullName = `No Car Dong ${String(stamp).slice(-7)}`;
  const phone = syntheticTestPhone();

  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 3,
    pricing: { paymentCollection: "free", registrationApproval: "auto" },
    transport: { mode: "shared_cars", dongAmountToman: "100000" },
  });
  expect(canonical.transport).toMatchObject({ mode: "shared_cars", dongAmount: 100_000 });

  await page.goto(`${PORTAL_OPERATOR_BASE_URL}/catalog/${encodeURIComponent(tourId)}/register`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready], [data-public-registration-intake][data-registration-ready]"
    )
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });

  const phoneStep = page.locator("[data-public-registration-phone][data-registration-ready]");
  if (await phoneStep.isVisible().catch(() => false)) {
    await requestRegistrationOtp(page, phone);
    await fillCatalogOtp(page, "1234");
  }

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill(fullName);
    const [profileResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/api/public-auth/register-complete"),
        { timeout: 90_000 }
      ),
      page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true }),
    ]);
    expect(
      profileResponse.ok(),
      `profile completion failed (${profileResponse.status()})`
    ).toBeTruthy();
  }
  await page
    .locator("[data-public-registration-intake][data-registration-ready]")
    .waitFor({ state: "visible", timeout: 120_000 });

  const registrationRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/api/catalog/registrations"),
    { timeout: 90_000 }
  );
  const registrationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations"),
    { timeout: 90_000 }
  );
  // The helper normally waits for a specific UI result. Start it, but observe
  // the actual POST first so an unexpected success cannot spend 90 seconds
  // waiting for the negative-state selector.
  const intakeUi = completeCatalogRegistrationIntake(page, {
    fullName,
    phone,
    partySize: "1",
    registrantTarget: "self",
    // Existing helper selects no personal car + pay dong by default.
    expectSuccess: false,
  });
  void intakeUi.catch(() => undefined);

  const request = await registrationRequest;
  const payload = JSON.parse(request.postData() ?? "{}") as {
    transport?: { kind?: string };
  };
  const response = await registrationResponse;
  const responseBody = (await response.json()) as {
    ok?: boolean;
    code?: string;
    registrationId?: string | null;
    status?: string | null;
  };

  // Let the UI settle only briefly; status and roster are the source of truth
  // for this boundary even when the current runtime violates it.
  await Promise.race([intakeUi, new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);

  let matchingRosterRows: readonly { id?: string; guestLabel?: string; status?: string }[] = [];
  await withOperatorBookingsUi(browser, async (adminPage) => {
    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as {
      items?: readonly { id?: string; guestLabel?: string; status?: string }[];
    };
    matchingRosterRows = (roster.items ?? []).filter((row) => row.guestLabel === fullName);
  });

  console.info(
    `[TC-CL-VEHICLE-NO-CAR-01] ${JSON.stringify({
      tourId,
      canonicalTransport: canonical.transport,
      transportKind: payload.transport?.kind,
      responseStatus: response.status(),
      responseCode: responseBody.code,
      registrationId: responseBody.registrationId ?? null,
      rosterRows: matchingRosterRows.length,
      rosterStatuses: matchingRosterRows.map((row) => row.status),
      responseBody,
    })}`
  );

  expect(payload.transport?.kind).toBe("no_car_dong");
  expect(response.status()).toBe(409);
  expect(responseBody.code).toBe("BOOKING_TRANSPORT_CAPACITY_REJECTED");
  expect(responseBody.registrationId).toBeFalsy();
  expect(matchingRosterRows).toHaveLength(0);
});
