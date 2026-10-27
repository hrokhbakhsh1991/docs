/** Staging flow: paid/manual registration on a bus tour through receipt review. */
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
  readonly id?: string;
  readonly status?: string;
};

type RegistrationRow = {
  readonly id?: string;
  readonly guestLabel?: string;
  readonly status?: string;
  readonly paymentStatus?: string;
  readonly partySize?: number;
};

test("paid manual bus registration stays in sync through receipt approval", async ({
  page,
  browser,
}) => {
  test.setTimeout(420_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const fullName = `Paid Bus Member ${suffix}`;
  const phone = syntheticTestPhone();
  const nationalId = syntheticNationalId(stamp + 900);

  const { tourId, canonical } = await publishTourForClosure(page, `TC paid manual bus ${stamp}`, {
    capacityMax: 2,
    pricing: {
      paymentCollection: "paid",
      registrationApproval: "manual",
      basePriceToman: "500000",
    },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  expect(canonical.pricing).toBeTruthy();
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
    await requestRegistrationOtp(page, phone);
    await fillCatalogOtp(page, "1234");
  }

  let registrationResponse: { status: number; body: RegistrationResponse } | undefined;
  const onRegistrationResponse = async (response: import("@playwright/test").Response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations")
    ) {
      registrationResponse = {
        status: response.status(),
        body: (await response.json()) as RegistrationResponse,
      };
    }
  };
  page.on("response", onRegistrationResponse);
  try {
    await completeCatalogRegistrationIntake(page, {
      fullName,
      phone,
      nationalId,
      fatherName: `Bus Member Father ${suffix}`,
      partySize: "1",
      registrantTarget: "self",
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 90_000,
  });
  expect(registrationResponse?.status).toBe(201);
  const registrationId = registrationResponse?.body.registrationId ?? registrationResponse?.body.id;
  expect(registrationId).toBeTruthy();
  expect(registrationResponse?.body.status).toBe("pending");

  const readMemberRegistration = async () => {
    const response = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId!)}`
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()) as {
      data?: { status?: string; paymentStatus?: string };
    };
  };
  expect((await readMemberRegistration()).data?.status).toBe("pending");

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const readRoster = async (): Promise<RegistrationRow[]> => {
      const response = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      const body = (await response.json()) as { items?: readonly RegistrationRow[] };
      return [...(body.items ?? [])].filter((row) => row.id === registrationId);
    };

    let rows = await readRoster();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      guestLabel: expect.stringContaining(fullName),
      status: "pending",
      partySize: 1,
    });

    await operatorApproveBookingViaUi(adminPage, {
      guestLabel: fullName,
      bookingId: registrationId!,
    });

    const detailPageResponse = await page.goto(
      `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(registrationId!)}`,
      { waitUntil: "domcontentloaded" }
    );
    const memberAfterApproval = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId!)}`
    );
    const memberAfterApprovalText = await memberAfterApproval.text();
    expect(
      detailPageResponse?.status(),
      `Portal detail page returned ${detailPageResponse?.status()}; member API ${memberAfterApproval.status()}: ${memberAfterApprovalText}`
    ).toBe(200);
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await page
      .locator("[data-portal-member-receipt-note]")
      .fill("Synthetic staging test receipt; no funds transferred");
    await page.locator("#receipt-file").setInputFiles({
      name: `synthetic-paid-bus-${registrationId}.png`,
      mimeType: "image/png",
      buffer: Buffer.from("Synthetic test receipt only; payment gateway not used"),
    });

    const [receiptResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/me/registrations/${registrationId}/receipt`,
        { timeout: 60_000 }
      ),
      page.locator("[data-portal-member-receipt-submit]").click(),
    ]);
    const receiptText = await receiptResponse.text();
    expect(receiptResponse.status(), receiptText).toBe(201);
    const receiptBody = JSON.parse(receiptText) as {
      data?: { id?: string; status?: string };
    };
    expect(receiptBody.data?.id).toBeTruthy();
    expect(receiptBody.data?.status).toBe("Pending");
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });

    await adminPage.goto(
      `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId!)}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(adminPage.getByTestId("finance-receipts-panel")).toBeVisible({
      timeout: 60_000,
    });
    const receiptRow = adminPage
      .getByTestId("finance-receipts-list")
      .getByRole("listitem")
      .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
    const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
    await expect(reviewForm).toBeVisible({ timeout: 60_000 });
    const reviewResponsePromise = adminPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `/api/finance/receipts/${receiptBody.data!.id}/review`
    );
    await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
    const reviewResponse = await reviewResponsePromise;
    expect(reviewResponse.status(), await reviewResponse.text()).toBe(200);

    rows = await readRoster();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      guestLabel: expect.stringContaining(fullName),
      status: "approved",
      paymentStatus: "paid",
      partySize: 1,
    });
  });

  const finalMemberRegistration = await readMemberRegistration();
  expect(finalMemberRegistration.data?.status).toBe("approved");
  expect(finalMemberRegistration.data?.paymentStatus?.toLowerCase()).toBe("paid");
});
