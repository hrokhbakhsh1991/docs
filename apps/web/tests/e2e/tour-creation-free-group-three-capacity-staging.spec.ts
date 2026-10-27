/** Staging boundary: three free guests on a two-seat tour, auto and manual. */
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
  readonly transportKind?: string | null;
};

test.describe("TC-CL-GROUP-CAPACITY-03: three guests at capacity two", () => {
  test.describe.configure({ mode: "serial" });

  test("free auto approves two guests and waitlists the third", async ({ page, browser }) => {
    const result = await registerThreeGuests(page, "auto");
    expect(result.registrations.map(({ status }) => status)).toEqual([
      "approved",
      "approved",
      "waitlisted",
    ]);

    for (let index = 0; index < result.ids.length; index++) {
      await expectMemberStatus(page, result.ids[index]!, result.registrations[index]!.status!);
    }
    await expectRoster(browser, result, ["approved", "approved", "waitlisted"]);
  });

  test("free manual keeps all pending, approves two, and rejects third for capacity", async ({
    page,
    browser,
  }) => {
    const result = await registerThreeGuests(page, "manual");
    expect(result.registrations.map(({ status }) => status)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);

    for (const id of result.ids) await expectMemberStatus(page, id, "pending");

    await withOperatorBookingsUi(browser, async (adminPage) => {
      let rows = await readRoster(adminPage, result.tourId, result.ids);
      expectRows(rows, result, ["pending", "pending", "pending"]);

      await operatorApproveBookingViaUi(adminPage, {
        guestLabel: result.names[0]!,
        bookingId: result.ids[0]!,
      });
      await operatorApproveBookingViaUi(adminPage, {
        guestLabel: result.names[1]!,
        bookingId: result.ids[1]!,
      });
      const thirdApproval = await adminPage.request.post(`/api/bookings/${result.ids[2]}/approve`);
      const thirdApprovalText = await thirdApproval.text();
      expect(thirdApproval.status(), thirdApprovalText).toBe(409);
      expect(thirdApprovalText).toContain("BOOKING_CAPACITY_REJECTED");

      rows = await readRoster(adminPage, result.tourId, result.ids);
      expectRows(rows, result, ["approved", "approved", "pending"]);
      for (let index = 0; index < result.ids.length; index++) {
        await expectMemberStatus(
          page,
          result.ids[index]!,
          ["approved", "approved", "pending"][index]!
        );
      }
      await expectCapacitySnapshot(adminPage, result.ids[0]!, 2);
    });
  });
});

async function registerThreeGuests(
  page: import("@playwright/test").Page,
  approval: "auto" | "manual"
) {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const names = ["A", "B", "C"].map((letter) => `Capacity Three ${letter} ${suffix}`);
  const memberPhone = syntheticTestPhone();
  const guestPhones = names.map(() => syntheticTestPhone());
  const { tourId, canonical } = await publishTourForClosure(page, `TC group three ${stamp}`, {
    capacityMax: 2,
    pricing: { paymentCollection: "free", registrationApproval: approval },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  expect(canonical.capacityMax).toBe(2);
  expect(canonical.transport).toMatchObject({ mode: "bus" });

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
      guestCount: 3,
      guestOverrides: (index) => ({
        fullName: names[index]!,
        phone: guestPhones[index]!,
        nationalId: syntheticNationalId(stamp + index + 100),
        fatherName: `Capacity Three Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrations.map(({ status }) => status)).toEqual([201, 201, 201]);
  const ids = registrations.map(({ body }) => body.registrationId);
  expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
  expect(new Set(ids).size).toBe(3);
  return {
    tourId,
    names,
    ids: ids as string[],
    registrations: registrations.map(({ body }) => body),
  };
}

async function expectMemberStatus(
  page: import("@playwright/test").Page,
  id: string,
  status: string
) {
  const response = await page.request.get(
    `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(id)}`
  );
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  expect(JSON.parse(text)).toMatchObject({ data: { status } });
}

async function readRoster(
  adminPage: import("@playwright/test").Page,
  tourId: string,
  ids: readonly string[]
) {
  const response = await adminPage.request.get(
    `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
  );
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  const body = JSON.parse(text) as { items?: readonly RegistrationRow[] };
  return (body.items ?? []).filter((row) => ids.includes(row.id ?? ""));
}

function expectRows(
  rows: readonly RegistrationRow[],
  result: { ids: readonly string[]; names: readonly string[] },
  statuses: readonly string[]
) {
  expect(rows).toHaveLength(3);
  for (let index = 0; index < result.ids.length; index++) {
    expect(rows.find((row) => row.id === result.ids[index])).toMatchObject({
      guestLabel: expect.stringContaining(result.names[index]!),
      status: statuses[index],
      partySize: 1,
      transportKind: "primary",
    });
  }
}

async function expectRoster(
  browser: import("@playwright/test").Browser,
  result: {
    tourId: string;
    ids: readonly string[];
    names: readonly string[];
  },
  statuses: readonly string[]
) {
  await withOperatorBookingsUi(browser, async (adminPage) => {
    const rows = await readRoster(adminPage, result.tourId, result.ids);
    expectRows(rows, result, statuses);
    await expectCapacitySnapshot(adminPage, result.ids[0]!, 2);
  });
}

async function expectCapacitySnapshot(
  adminPage: import("@playwright/test").Page,
  bookingId: string,
  occupied: number
) {
  const response = await adminPage.request.get(`/api/bookings/${bookingId}`);
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  expect(JSON.parse(text)).toMatchObject({
    capacitySnapshot: { occupied, max: 2 },
    transportKind: "primary",
  });
}
