/** Staging characterization: operator approval cannot exceed a one-seat tour. */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticNationalId,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import {
  operatorApproveBookingViaUi,
  withOperatorBookingsUi,
} from "../../../portal/tests/e2e/fixtures/operator-booking-ui";
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
};

test("TC-CL-GROUP-CAPACITY-02 manual group intake stays pending and only one guest can be approved", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const title = `TC manual group capacity ${stamp}`;
  const memberPhone = syntheticTestPhone();
  const names = [`Manual Capacity A ${suffix}`, `Manual Capacity B ${suffix}`];
  const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];
  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 1,
    pricing: { paymentCollection: "free", registrationApproval: "manual" },
  });
  expect(canonical.capacityMax).toBe(1);

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
      registrations.push({
        status: response.status(),
        body: (await response.json()) as RegistrationResponse,
      });
    }
  };
  page.on("response", onRegistrationResponse);
  try {
    await completeCatalogRegistrationIntake(page, {
      fullName: names[0],
      phone: memberPhone,
      partySize: "1",
      registrantTarget: "other",
      guestCount: 2,
      guestOverrides: (index) => ({
        fullName: names[index],
        phone: guestPhones[index],
        nationalId: syntheticNationalId(stamp + index + 100),
        fatherName: `Manual Capacity Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrations.map(({ status }) => status)).toEqual([201, 201]);
  expect(registrations.map(({ body }) => body.status)).toEqual(["pending", "pending"]);
  const registrationIds = registrations.map(({ body }) => body.registrationId);
  expect(registrationIds.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
  expect(new Set(registrationIds).size).toBe(2);
  const ids = registrationIds as string[];

  for (const id of ids) {
    const response = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(id)}`
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const body = (await response.json()) as { data?: { status?: string } };
    expect(body.data?.status).toBe("pending");
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const readRoster = async (): Promise<RegistrationRow[]> => {
      const response = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      const body = (await response.json()) as { items?: readonly RegistrationRow[] };
      return [...(body.items ?? [])].filter((row) => ids.includes(row.id ?? ""));
    };

    let rows = await readRoster();
    expect(rows).toHaveLength(2);
    for (let index = 0; index < ids.length; index++) {
      expect(rows.find((row) => row.id === ids[index])).toMatchObject({
        guestLabel: expect.stringContaining(names[index]),
        status: "pending",
        partySize: 1,
      });
    }

    await operatorApproveBookingViaUi(adminPage, { guestLabel: names[0], bookingId: ids[0]! });
    const secondApproval = await adminPage.request.post(`/api/bookings/${ids[1]}/approve`);
    const secondApprovalText = await secondApproval.text();
    expect(secondApproval.status(), secondApprovalText).toBe(409);
    expect(secondApprovalText).toContain("BOOKING_CAPACITY_REJECTED");

    rows = await readRoster();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === ids[0])?.status).toBe("approved");
    expect(rows.find((row) => row.id === ids[1])?.status).toBe("pending");

    for (const [index, expectedStatus] of ["approved", "pending"].entries()) {
      const response = await page.request.get(
        `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(ids[index]!)}`
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      const body = (await response.json()) as { data?: { status?: string } };
      expect(body.data?.status).toBe(expectedStatus);
    }

    const approvedDetailResponse = await adminPage.request.get(`/api/bookings/${ids[0]}`);
    expect(approvedDetailResponse.ok(), await approvedDetailResponse.text()).toBeTruthy();
    const approvedDetail = (await approvedDetailResponse.json()) as {
      capacitySnapshot?: { occupied?: number; max?: number };
    };
    expect(approvedDetail.capacitySnapshot).toEqual({ occupied: 1, max: 1 });
  });
});
