/** Staging flow: paid/manual two-guest bus group through receipt review. */
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
  readonly transportKind?: string | null;
};

test("paid manual two-guest bus group completes receipt review at exact capacity", async ({
  page,
  browser,
}) => {
  test.setTimeout(540_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const memberPhone = syntheticTestPhone();
  const names = [`Paid Bus Group A ${suffix}`, `Paid Bus Group B ${suffix}`];
  const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];
  const { tourId, canonical } = await publishTourForClosure(page, `TC paid bus group ${stamp}`, {
    capacityMax: 2,
    pricing: {
      paymentCollection: "paid",
      registrationApproval: "manual",
      basePriceToman: "500000",
    },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  expect(canonical.capacityMax).toBe(2);
  expect(canonical.pricing).toBeTruthy();
  expect(canonical.transport).toMatchObject({ mode: "bus" });

  const gatewayRequests: string[] = [];
  const recordGatewayRequest = (request: import("@playwright/test").Request) => {
    const path = new URL(request.url()).pathname;
    if (
      !["GET", "HEAD"].includes(request.method()) &&
      /gateway|checkout|payment-session|payment-intent/i.test(path)
    ) {
      gatewayRequests.push(`${request.method()} ${path}`);
    }
  };
  page.on("request", recordGatewayRequest);

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
        nationalId: syntheticNationalId(stamp + index + 1700),
        fatherName: `Paid Bus Group Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrations.map(({ status }) => status)).toEqual([201, 201]);
  expect(registrations.map(({ body }) => body.status)).toEqual(["pending", "pending"]);
  const rawIds = registrations.map(({ body }) => body.registrationId ?? body.id);
  expect(rawIds.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
  expect(new Set(rawIds).size).toBe(2);
  const ids = rawIds as string[];

  const readMember = async (id: string) => {
    const response = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(id)}`
    );
    const text = await response.text();
    expect(response.ok(), text).toBeTruthy();
    return (JSON.parse(text) as { data?: { status?: string; paymentStatus?: string } }).data;
  };
  for (const id of ids) {
    const member = await readMember(id);
    expect(member?.status).toBe("pending");
    expect(member?.paymentStatus?.toLowerCase()).not.toBe("paid");
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    adminPage.on("request", recordGatewayRequest);
    const readRoster = async (): Promise<RegistrationRow[]> => {
      const response = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      const text = await response.text();
      expect(response.ok(), text).toBeTruthy();
      const body = JSON.parse(text) as { items?: readonly RegistrationRow[] };
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

    for (const [index, id] of ids.entries()) {
      await operatorApproveBookingViaUi(adminPage, { guestLabel: names[index]!, bookingId: id });
    }
    rows = await readRoster();
    expect(rows).toHaveLength(2);
    for (const [index, id] of ids.entries()) {
      expect(rows.find((row) => row.id === id)).toMatchObject({
        guestLabel: expect.stringContaining(names[index]),
        status: "approved",
        partySize: 1,
        transportKind: "primary",
      });
    }
    const capacityResponse = await adminPage.request.get(`/api/bookings/${ids[0]}`);
    const capacityText = await capacityResponse.text();
    expect(capacityResponse.ok(), capacityText).toBeTruthy();
    expect(JSON.parse(capacityText)).toMatchObject({ capacitySnapshot: { occupied: 2, max: 2 } });

    for (const id of ids) {
      const member = await readMember(id);
      expect(member?.status).toBe("approved");
      expect(member?.paymentStatus?.toLowerCase()).not.toBe("paid");

      const detailResponse = await page.goto(
        `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(id)}`,
        { waitUntil: "domcontentloaded" }
      );
      expect(detailResponse?.status()).toBe(200);
      await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
        timeout: 60_000,
      });
      await page
        .locator("[data-portal-member-receipt-note]")
        .fill("Synthetic staging group receipt; no funds transferred");
      await page.locator("#receipt-file").setInputFiles({
        name: `synthetic-paid-bus-group-${id}.png`,
        mimeType: "image/png",
        buffer: Buffer.from("Synthetic test receipt only; payment gateway not used"),
      });

      const [receiptResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname === `/api/me/registrations/${id}/receipt`,
          { timeout: 60_000 }
        ),
        page.locator("[data-portal-member-receipt-submit]").click(),
      ]);
      const receiptText = await receiptResponse.text();
      expect(receiptResponse.status(), receiptText).toBe(201);
      const receipt = JSON.parse(receiptText) as { data?: { id?: string; status?: string } };
      expect(receipt.data?.id).toBeTruthy();
      expect(receipt.data?.status).toBe("Pending");
      await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
        timeout: 60_000,
      });

      await adminPage.goto(`/finance?tab=receipts&registrationId=${encodeURIComponent(id)}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(adminPage.getByTestId("finance-receipts-panel")).toBeVisible({
        timeout: 60_000,
      });
      const receiptRow = adminPage
        .getByTestId("finance-receipts-list")
        .getByRole("listitem")
        .filter({ has: adminPage.locator(`a[title="${id}"]`) });
      const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
      await expect(reviewForm).toBeVisible({ timeout: 60_000 });
      const reviewResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === `/api/finance/receipts/${receipt.data!.id}/review`
      );
      await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
      const reviewResponse = await reviewResponsePromise;
      const reviewText = await reviewResponse.text();
      expect(reviewResponse.status(), reviewText).toBe(200);
    }

    rows = await readRoster();
    expect(rows).toHaveLength(2);
    for (const [index, id] of ids.entries()) {
      expect(rows.find((row) => row.id === id)).toMatchObject({
        guestLabel: expect.stringContaining(names[index]),
        status: "approved",
        paymentStatus: "paid",
        partySize: 1,
        transportKind: "primary",
      });
      const member = await readMember(id);
      expect(member?.status).toBe("approved");
      expect(member?.paymentStatus?.toLowerCase()).toBe("paid");
    }
  });

  page.off("request", recordGatewayRequest);
  expect(gatewayRequests).toEqual([]);
});
