import { expect, test } from "@playwright/test";

import {
  completePortalRegistrationForTour,
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

type RegistrationResponse = { readonly id?: string; readonly registrationId?: string };
type ReceiptUploadResponse = {
  readonly data?: { readonly id?: string; readonly status?: string };
  readonly status?: string;
};

test("TC-CL-RECEIPT-IDEM-01 synthetic receipt approval replay creates one financial outcome", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const title = `TC-CL receipt replay ${stamp}`;
  const phone = `+1555${String(stamp).slice(-7)}`;
  const guestName = `Receipt Replay ${stamp}`;

  // Manual receipt evidence exercises approval without opening a payment gateway.
  const { tourId } = await publishTourForClosure(page, title, {
    pricing: {
      paymentCollection: "paid",
      registrationApproval: "auto",
      basePriceToman: "500000",
    },
  });

  const registrationResponses: Array<{ status: number; body: RegistrationResponse }> = [];
  const registrationListener = async (response: import("@playwright/test").Response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations")
    ) {
      try {
        registrationResponses.push({ status: response.status(), body: await response.json() });
      } catch {
        registrationResponses.push({ status: response.status(), body: {} });
      }
    }
  };
  page.on("response", registrationListener);
  try {
    await completePortalRegistrationForTour(page, tourId, { phone, fullName: guestName });
  } finally {
    page.off("response", registrationListener);
  }
  expect(registrationResponses.map(({ status }) => status)).toContain(201);
  const registrationId = registrationResponses
    .map(({ body }) => body.registrationId ?? body.id)
    .find((id): id is string => typeof id === "string" && id.length > 0);
  expect(registrationId, "portal registration response must include its ID").toBeTruthy();

  const registration = await page.request.get(
    `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId!)}`
  );
  expect(registration.ok(), await registration.text()).toBeTruthy();
  expect((await registration.json()).data?.status).toBe("approved");
  await page.goto(
    `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(registrationId!)}`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
    timeout: 60_000,
  });
  await page
    .locator("[data-portal-member-receipt-note]")
    .fill("Synthetic test receipt; no funds transferred");
  await page.locator("#receipt-file").setInputFiles({
    name: "synthetic-test-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("synthetic test receipt; no payment gateway used"),
  });

  const [receiptUpload] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/receipt")
    ),
    page.locator("[data-portal-member-receipt-submit]").click(),
  ]);
  const receiptUploadText = await receiptUpload.text();
  expect(receiptUpload.status(), receiptUploadText).toBe(201);
  const receiptUploadBody = JSON.parse(receiptUploadText) as ReceiptUploadResponse;
  const receiptId = receiptUploadBody.data?.id;
  expect(receiptId, "receipt upload response data must include its ID").toBeTruthy();
  expect(receiptUploadBody.data?.status).toBe("Pending");

  await withOperatorBookingsUi(browser, async (adminPage) => {
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
        new URL(response.url()).pathname.endsWith(`/api/finance/receipts/${receiptId}/review`)
    );
    await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
    const firstReview = await reviewResponsePromise;
    const firstReviewText = await firstReview.text();
    expect(firstReview.status(), firstReviewText).toBe(200);

    const firstRequest = firstReview.request();
    const idempotencyKey = firstRequest.headers()["idempotency-key"];
    const requestBody = firstRequest.postData();
    expect(idempotencyKey, "approval must carry an idempotency key").toBeTruthy();
    expect(requestBody, "approval must carry a replayable request body").toBeTruthy();

    const replayKey = idempotencyKey!;
    const replayBodyText = requestBody!;
    expect(replayKey).toBe(idempotencyKey);
    expect(replayBodyText).toBe(requestBody);
    const reviewPath = new URL(firstReview.url()).pathname;
    const replay = await adminPage.request.patch(reviewPath, {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": replayKey,
      },
      data: replayBodyText,
    });
    const replayText = await replay.text();
    expect(replay.status(), replayText).toBe(200);

    const firstBody = JSON.parse(firstReviewText) as {
      id?: string;
      status?: string;
      ledgerJournalId?: string;
      bookingPaymentStatus?: string;
    };
    const replayBody = JSON.parse(replayText) as typeof firstBody;
    expect(firstBody).toMatchObject({
      id: receiptId,
      status: "Approved",
      bookingPaymentStatus: "paid",
    });
    expect(replayBody).toMatchObject({
      id: receiptId,
      status: "Approved",
      ledgerJournalId: firstBody.ledgerJournalId,
      bookingPaymentStatus: "paid",
    });
    expect(firstBody.ledgerJournalId).toBeTruthy();

    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as {
      items?: Array<{ id?: string; status?: string; paymentStatus?: string }>;
    };
    const matchingRows = (roster.items ?? []).filter((item) => item.id === registrationId);
    expect(matchingRows).toHaveLength(1);
    expect(matchingRows[0]).toMatchObject({ status: "approved", paymentStatus: "paid" });

    const evidence = {
      receiptId,
      idempotencyKey,
      requestBody,
      replayUsedSameKey: replayKey === idempotencyKey,
      replayUsedSameBody: replayBodyText === requestBody,
      ledgerJournalId: firstBody.ledgerJournalId,
      rosterRows: matchingRows.length,
      paymentStatus: matchingRows[0]?.paymentStatus,
      gateway: "not used; synthetic manual receipt",
    };
    test
      .info()
      .annotations.push({ type: "staging-evidence", description: JSON.stringify(evidence) });
    console.log(`[TC-CL-RECEIPT-IDEM-01] ${JSON.stringify(evidence)}`);
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
    timeout: 60_000,
  });
});
