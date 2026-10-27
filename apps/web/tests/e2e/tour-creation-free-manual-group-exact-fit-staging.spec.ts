/** Staging exact-fit boundary: two free manual guests fill a two-seat bus tour. */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticNationalId,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";
import {
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";

type RegistrationResponse = {
  readonly registrationId?: string;
  readonly status?: string;
};

type RegistrationRow = {
  readonly id?: string;
  readonly guestLabel?: string;
  readonly status?: string;
  readonly partySize?: number;
  readonly transportKind?: string | null;
};

test("TC-CL-GROUP-CAPACITY-04 free manual two-guest group exactly fills capacity two", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const names = [`Exact Fit A ${suffix}`, `Exact Fit B ${suffix}`];
  const memberPhone = syntheticTestPhone();
  const guestPhones = names.map(() => syntheticTestPhone());
  const { tourId, canonical } = await publishTourForClosure(page, `TC exact fit ${stamp}`, {
    capacityMax: 2,
    pricing: { paymentCollection: "free", registrationApproval: "manual" },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  expect(canonical.capacityMax).toBe(2);
  expect(canonical.transport).toMatchObject({ mode: "bus" });

  const paymentRequests: string[] = [];
  const recordPaymentRequest = (request: import("@playwright/test").Request) => {
    const path = new URL(request.url()).pathname;
    if (!["GET", "HEAD"].includes(request.method()) && /payment|receipt|gateway/i.test(path)) {
      paymentRequests.push(`${request.method()} ${path}`);
    }
  };
  page.on("request", recordPaymentRequest);

  await page.goto(`${PORTAL_OPERATOR_BASE_URL}/catalog/${encodeURIComponent(tourId)}/register`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready], [data-public-registration-intake][data-registration-ready]"
    )
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
  if (
    await page
      .locator("[data-public-registration-phone][data-registration-ready]")
      .isVisible()
      .catch(() => false)
  ) {
    await requestRegistrationOtp(page, memberPhone);
    await fillCatalogOtp(page, "1234");
  }

  const registrations: Array<{ status: number; body: RegistrationResponse }> = [];
  const onRegistrationResponse = async (response: import("@playwright/test").Response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations")
    ) {
      registrations.push({ status: response.status(), body: await response.json() });
    }
  };
  page.on("response", onRegistrationResponse);
  try {
    await completeCatalogRegistrationIntake(page, {
      fullName: names[0]!,
      phone: memberPhone,
      partySize: "1",
      registrantTarget: "other",
      guestCount: 2,
      guestOverrides: (index) => ({
        fullName: names[index]!,
        phone: guestPhones[index]!,
        nationalId: syntheticNationalId(stamp + index + 100),
        fatherName: `Exact Fit Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrations.map(({ status }) => status)).toEqual([201, 201]);
  expect(registrations.map(({ body }) => body.status)).toEqual(["pending", "pending"]);
  const ids = registrations.map(({ body }) => body.registrationId);
  expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
  expect(new Set(ids).size).toBe(2);
  const registrationIds = ids as string[];

  for (const id of registrationIds) {
    const response = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(id)}`
    );
    const text = await response.text();
    expect(response.ok(), text).toBeTruthy();
    expect(JSON.parse(text)).toMatchObject({ data: { status: "pending" } });
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    adminPage.on("request", recordPaymentRequest);
    const readRoster = async () => {
      const response = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      const text = await response.text();
      expect(response.ok(), text).toBeTruthy();
      const body = JSON.parse(text) as { items?: readonly RegistrationRow[] };
      return (body.items ?? []).filter((row) => registrationIds.includes(row.id ?? ""));
    };

    let rows = await readRoster();
    expect(rows).toHaveLength(2);
    for (let index = 0; index < registrationIds.length; index++) {
      expect(rows.find((row) => row.id === registrationIds[index])).toMatchObject({
        guestLabel: expect.stringContaining(names[index]!),
        status: "pending",
        partySize: 1,
        transportKind: "primary",
      });
    }

    for (let index = 0; index < registrationIds.length; index++) {
      const approval = await adminPage.request.post(
        `/api/bookings/${registrationIds[index]}/approve`
      );
      const approvalText = await approval.text();
      expect(approval.status(), approvalText).toBe(200);
    }

    rows = await readRoster();
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.status).toBe("approved");
    for (const id of registrationIds) {
      const response = await page.request.get(
        `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(id)}`
      );
      const text = await response.text();
      expect(response.ok(), text).toBeTruthy();
      expect(JSON.parse(text)).toMatchObject({ data: { status: "approved" } });
    }

    const detailResponse = await adminPage.request.get(`/api/bookings/${registrationIds[0]}`);
    const detailText = await detailResponse.text();
    expect(detailResponse.ok(), detailText).toBeTruthy();
    expect(JSON.parse(detailText)).toMatchObject({
      capacitySnapshot: { occupied: 2, max: 2 },
      transportKind: "primary",
    });
  });
  page.off("request", recordPaymentRequest);
  expect(paymentRequests).toEqual([]);
});
