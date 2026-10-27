/** Staging lifecycle: offline partial payment, receipt review, and final settlement. */
import { expect, test } from "@playwright/test";
import ExcelJS from "../../../api/node_modules/exceljs/excel.js";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticNationalId,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import { FINANCE_RECEIPTS_TEST_IDS } from "../../src/finance/finance-receipts-logic";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";
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

type Invoice = {
  readonly invoiceTotalMinor?: string;
  readonly paidAmountMinor?: string;
  readonly balanceDueMinor?: string;
  readonly initialPaymentDueMinor?: string;
  readonly amountDueNowMinor?: string;
  readonly currency?: string;
};

type FinancePayment = {
  readonly id?: string;
  readonly registrationId?: string;
  readonly amount?: string;
  readonly currency?: string;
  readonly method?: string;
  readonly provider?: string;
  readonly status?: string;
  readonly paidAt?: string | null;
};

const FAILED_SYNTHETIC_REGISTRATION_ID = "5d77e7a2-95ff-417c-998f-0d08db0e6071";
const FAILED_PARTIAL_REGISTRATION_ID = "34b482d0-88ce-488e-864b-8143c5e31e54";
const FAILED_FINAL_PARTIAL_REGISTRATION_ID = "baa2dde2-ea68-4fa3-84c7-9c60221ed757";

type PendingReceipt = {
  readonly id?: string;
  readonly note?: string;
  readonly paymentId?: string;
  readonly payment?: FinancePayment;
};

type WorkbookSheet = {
  readonly rowCount: number;
  getCell(row: number, column: number): { readonly text: string };
};
type Workbook = {
  readonly xlsx: { load(data: Buffer): Promise<void> };
  getWorksheet(name: string): WorkbookSheet | undefined;
};

async function readInvoice(page: import("@playwright/test").Page, registrationId: string) {
  const response = await page.request.get(
    `/api/finance/invoices/${encodeURIComponent(registrationId)}`
  );
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  return JSON.parse(text) as Invoice;
}

async function readPayments(page: import("@playwright/test").Page, registrationId: string) {
  const response = await page.request.get(
    `/api/finance/payments?limit=50&registrationId=${encodeURIComponent(registrationId)}`
  );
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  return (JSON.parse(text) as { items?: FinancePayment[] }).items ?? [];
}

async function readPendingReceipts(page: import("@playwright/test").Page, registrationId: string) {
  const response = await page.request.get(
    `/api/finance/receipts/pending?limit=50&registrationId=${encodeURIComponent(registrationId)}`
  );
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  return (JSON.parse(text) as { items?: PendingReceipt[] }).items ?? [];
}

async function resolveFailedSyntheticFixture(
  adminPage: import("@playwright/test").Page,
  registrationId: string
) {
  const pendingReceipts = await readPendingReceipts(adminPage, registrationId);
  const failedReceipt = pendingReceipts.find(
    (receipt) =>
      receipt.note?.startsWith("Synthetic staging receipt ") === true &&
      receipt.payment?.registrationId === registrationId
  );
  if (failedReceipt === undefined) {
    console.log(`[QA failed synthetic fixture already resolved] ${registrationId}`);
    return;
  }
  const failedReceiptNote = failedReceipt.note ?? "Synthetic staging receipt";
  const receiptPaymentId = failedReceipt.payment?.id ?? failedReceipt.paymentId;
  expect(receiptPaymentId).toBeTruthy();
  expect(failedReceipt.payment).toMatchObject({
    registrationId,
    method: "Manual",
    provider: "manual",
    status: "Pending",
    paidAt: null,
  });
  expect(BigInt(failedReceipt.payment?.amount ?? "0")).toBeGreaterThan(0n);

  await adminPage.goto(
    `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
    { waitUntil: "domcontentloaded" }
  );
  const row = adminPage
    .getByTestId(FINANCE_RECEIPTS_TEST_IDS.list)
    .getByRole("listitem")
    .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) })
    .filter({ hasText: failedReceiptNote });
  const reviewForm = row.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm);
  await expect(reviewForm).toBeVisible({ timeout: 60_000 });
  await reviewForm
    .locator("input")
    .fill("Failed synthetic partial-payment run; no funds transferred");
  const [rejectResponse] = await Promise.all([
    adminPage.waitForResponse(
      (candidate) =>
        candidate.request().method() === "PATCH" &&
        new URL(candidate.url()).pathname === `/api/finance/receipts/${failedReceipt.id}/review`,
      { timeout: 60_000 }
    ),
    reviewForm.getByRole("button", { name: /reject|رد/i }).click(),
  ]);
  const rejectText = await rejectResponse.text();
  expect(rejectResponse.status(), rejectText).toBe(200);
  expect(JSON.parse(rejectText)).toMatchObject({ status: "Rejected" });

  await adminPage.goto(
    `/finance?tab=payments&registrationId=${encodeURIComponent(registrationId)}`,
    { waitUntil: "domcontentloaded" }
  );
  const paymentsPanel = adminPage.getByTestId(FINANCE_PAYMENTS_TEST_IDS.panel);
  await expect(paymentsPanel).toBeVisible({ timeout: 60_000 });
  const beforeCancel = await readPayments(adminPage, registrationId);
  const pendingPayments = beforeCancel.filter(
    (payment) => payment.registrationId === registrationId && payment.status === "Pending"
  );
  expect(pendingPayments.length).toBeGreaterThan(0);
  expect(pendingPayments.some((payment) => payment.id === receiptPaymentId)).toBeTruthy();
  console.log(
    "[QA synthetic payment rows before UI cancellation]",
    JSON.stringify(pendingPayments)
  );

  const cancelled: Array<{ paymentId: string; status: string }> = [];
  for (const payment of pendingPayments) {
    const paymentId = payment.id;
    expect(paymentId).toBeTruthy();
    const paymentRow = adminPage
      .getByTestId(FINANCE_PAYMENTS_TEST_IDS.list)
      .getByRole("listitem")
      .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) })
      .filter({ has: adminPage.getByTestId(FINANCE_PAYMENTS_TEST_IDS.cancelOpen) });
    await expect(paymentRow).toBeVisible({ timeout: 60_000 });
    await paymentRow.getByTestId(FINANCE_PAYMENTS_TEST_IDS.cancelOpen).click();
    const cancelDialog = adminPage.getByTestId(FINANCE_PAYMENTS_TEST_IDS.cancelDialog);
    await expect(cancelDialog).toBeVisible();
    await cancelDialog
      .getByTestId(FINANCE_PAYMENTS_TEST_IDS.cancelReason)
      .selectOption("abandoned");
    const [cancelResponse] = await Promise.all([
      adminPage.waitForResponse(
        (candidate) =>
          candidate.request().method() === "POST" &&
          new URL(candidate.url()).pathname === `/api/finance/payments/${paymentId}/cancel`,
        { timeout: 60_000 }
      ),
      cancelDialog.getByTestId(FINANCE_PAYMENTS_TEST_IDS.cancelConfirm).click(),
    ]);
    const cancelText = await cancelResponse.text();
    expect(cancelResponse.status(), cancelText).toBe(200);
    const result = JSON.parse(cancelText) as { status?: string };
    expect(result).toMatchObject({ status: "Cancelled" });
    cancelled.push({ paymentId: paymentId!, status: result.status! });
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await expect(paymentsPanel).toBeVisible({ timeout: 60_000 });
  }
  const afterCancel = await readPayments(adminPage, registrationId);
  for (const { paymentId, status } of cancelled) {
    expect(status).toBe("Cancelled");
    expect(afterCancel.find((payment) => payment.id === paymentId)?.status).toBe("Cancelled");
  }
  expect(
    afterCancel.filter(
      (payment) => payment.registrationId === registrationId && payment.status === "Pending"
    )
  ).toHaveLength(0);
  console.log(
    "[QA resolved failed synthetic fixture]",
    JSON.stringify({
      registrationId,
      receiptId: failedReceipt.id,
      receiptStatus: JSON.parse(rejectText).status,
      receiptPaymentId,
      receiptPaymentAmount: failedReceipt.payment?.amount,
      receiptNote: failedReceiptNote,
      cancelledPayments: cancelled,
    })
  );
}

async function readMember(page: import("@playwright/test").Page, registrationId: string) {
  const response = await page.request.get(
    `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId)}`
  );
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  return (JSON.parse(text) as { data?: { status?: string; paymentStatus?: string } }).data;
}

async function uploadMemberReceipt(
  page: import("@playwright/test").Page,
  registrationId: string,
  suffix: string
): Promise<{ receiptId: string; paymentId?: string }> {
  await page.goto(
    `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(registrationId)}`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
    timeout: 60_000,
  });
  await page
    .locator("[data-portal-member-receipt-note]")
    .fill(`Synthetic staging receipt ${suffix}; no funds transferred`);
  await page.locator("#receipt-file").setInputFiles({
    name: `synthetic-partial-${suffix}-${registrationId}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(`Synthetic staging receipt ${suffix}; no funds transferred`),
  });
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        new URL(candidate.url()).pathname === `/api/me/registrations/${registrationId}/receipt`,
      { timeout: 60_000 }
    ),
    page.locator("[data-portal-member-receipt-submit]").click(),
  ]);
  const text = await response.text();
  expect(response.status(), text).toBe(201);
  const payload = JSON.parse(text) as {
    data?: { id?: string; status?: string; paymentId?: string; payment?: FinancePayment };
  };
  console.log("[QA receipt submission payload]", JSON.stringify(payload));
  expect(payload.data?.id).toBeTruthy();
  expect(payload.data?.status).toBe("Pending");
  await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
    timeout: 60_000,
  });
  return { receiptId: payload.data!.id!, paymentId: payload.data?.paymentId };
}

async function reviewReceiptInFinanceUi(
  adminPage: import("@playwright/test").Page,
  registrationId: string,
  receiptId: string,
  expectedAmountFit: "under" | "exact",
  expectedBookingPaymentStatus: "partial" | "paid"
): Promise<void> {
  await adminPage.goto(
    `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(adminPage.getByTestId(FINANCE_RECEIPTS_TEST_IDS.panel)).toBeVisible({
    timeout: 60_000,
  });
  const receiptRow = adminPage
    .getByTestId(FINANCE_RECEIPTS_TEST_IDS.list)
    .getByRole("listitem")
    .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
  const reviewForm = receiptRow.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm);
  await expect(reviewForm).toBeVisible({ timeout: 60_000 });
  await expect(receiptRow.getByTestId(FINANCE_RECEIPTS_TEST_IDS.amountFit)).toHaveAttribute(
    "data-amount-fit",
    expectedAmountFit
  );

  const [response] = await Promise.all([
    adminPage.waitForResponse(
      (candidate) =>
        candidate.request().method() === "PATCH" &&
        new URL(candidate.url()).pathname === `/api/finance/receipts/${receiptId}/review`,
      { timeout: 60_000 }
    ),
    reviewForm.getByRole("button", { name: /approve|تأیید/i }).click(),
  ]);
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  expect(JSON.parse(text)).toMatchObject({
    status: "Approved",
    bookingPaymentStatus: expectedBookingPaymentStatus,
  });
}

async function readRosterRow(
  adminPage: import("@playwright/test").Page,
  tourId: string,
  registrationId: string
): Promise<RegistrationRow> {
  const response = await adminPage.request.get(
    `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
  );
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  const body = JSON.parse(text) as { items?: readonly RegistrationRow[] };
  const row = (body.items ?? []).find((item) => item.id === registrationId);
  expect(row).toBeTruthy();
  return row!;
}

async function readXlsxFinancialState(
  adminPage: import("@playwright/test").Page,
  tourId: string,
  guestName: string
): Promise<{ finalStatus: string; followupContainsGuest: boolean; paidContainsGuest: boolean }> {
  const response = await adminPage.request.get(
    `/api/tours/${encodeURIComponent(tourId)}/operational-roster/export?filter=final&format=xlsx`
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  const bytes = await response.body();
  expect(bytes.subarray(0, 2).toString("hex")).toBe("504b");
  const workbook = new ExcelJS.Workbook() as unknown as Workbook;
  await workbook.xlsx.load(bytes);
  const finalSheet = workbook.getWorksheet("لیست نهایی");
  const followupSheet = workbook.getWorksheet("منتظر پرداخت");
  const paidSheet = workbook.getWorksheet("پرداخت‌شده");
  expect(finalSheet).toBeTruthy();
  expect(followupSheet).toBeTruthy();
  expect(paidSheet).toBeTruthy();

  let finalStatus = "";
  const findInSheet = (sheet: WorkbookSheet) => {
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      if (sheet.getCell(rowIndex, 2).text === guestName) {
        return sheet.getCell(rowIndex, 6).text;
      }
    }
    return null;
  };
  finalStatus = findInSheet(finalSheet!) ?? "";
  return {
    finalStatus,
    followupContainsGuest: findInSheet(followupSheet!) !== null,
    paidContainsGuest: findInSheet(paidSheet!) !== null,
  };
}

test("configured prepayment and member receipts transition unpaid to partial to paid across reloads", async ({
  page,
  browser,
}) => {
  test.setTimeout(600_000);
  await withOperatorBookingsUi(browser, async (adminPage) => {
    await resolveFailedSyntheticFixture(adminPage, FAILED_SYNTHETIC_REGISTRATION_ID);
    await resolveFailedSyntheticFixture(adminPage, FAILED_PARTIAL_REGISTRATION_ID);
    await resolveFailedSyntheticFixture(adminPage, FAILED_FINAL_PARTIAL_REGISTRATION_ID);
  });
  const stamp = Date.now();
  const suffix = String(stamp).slice(-8);
  const guestName = `Partial Receipt Member ${suffix}`;
  const phone = syntheticTestPhone();
  const { tourId, canonical } = await publishTourForClosure(page, `TC partial receipts ${stamp}`, {
    capacityMax: 2,
    pricing: {
      paymentCollection: "paid",
      registrationApproval: "auto",
      basePriceToman: "2500000",
      prepaymentEnabled: true,
      prepaymentPercent: 50,
    },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  expect(canonical.capacityMax).toBe(2);
  expect(canonical.pricing).toMatchObject({
    prepaymentEnabled: true,
    prepaymentPercent: 50,
  });
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
      fullName: guestName,
      phone,
      nationalId: syntheticNationalId(stamp + 6800),
      fatherName: `Partial Receipt Father ${suffix}`,
      partySize: "1",
      registrantTarget: "self",
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }
  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrationResponse?.status).toBe(201);
  expect(registrationResponse?.body.status).toBe("approved");
  const registrationId = registrationResponse?.body.registrationId ?? registrationResponse?.body.id;
  expect(registrationId).toBeTruthy();

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const initialInvoice = await readInvoice(adminPage, registrationId!);
    console.log("[QA partial receipt invoice before payment]", JSON.stringify(initialInvoice));
    expect(initialInvoice.invoiceTotalMinor).toBe("2500000");
    expect(initialInvoice.paidAmountMinor).toBe("0");
    expect(initialInvoice.balanceDueMinor).toBe(initialInvoice.invoiceTotalMinor);
    const total = BigInt(initialInvoice.invoiceTotalMinor!);
    const firstAmount = (total / 2n).toString();
    const secondAmount = (total - BigInt(firstAmount)).toString();
    expect(initialInvoice.initialPaymentDueMinor).toBe(firstAmount);
    expect(initialInvoice.amountDueNowMinor).toBe(firstAmount);
    expect(BigInt(firstAmount)).toBeGreaterThan(0n);
    expect(BigInt(secondAmount)).toBeGreaterThan(0n);
    const firstReceipt = await uploadMemberReceipt(page, registrationId!, "prepayment");
    const paymentsAfterFirstEntry = await readPayments(adminPage, registrationId!);
    const firstPayment = paymentsAfterFirstEntry.find(
      (payment) =>
        payment.registrationId === registrationId &&
        payment.amount === firstAmount &&
        payment.id === firstReceipt.paymentId
    );
    expect(firstPayment).toMatchObject({
      registrationId,
      amount: firstAmount,
      currency: initialInvoice.currency ?? "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
      paidAt: null,
    });
    await reviewReceiptInFinanceUi(
      adminPage,
      registrationId!,
      firstReceipt.receiptId,
      "under",
      "partial"
    );
    const afterFirst = await readInvoice(adminPage, registrationId!);
    expect(afterFirst.paidAmountMinor).toBe(firstAmount);
    expect(afterFirst.balanceDueMinor).toBe(secondAmount);
    const memberAfterFirst = await readMember(page, registrationId!);
    expect(memberAfterFirst?.status).toBe("approved");
    expect(memberAfterFirst?.paymentStatus).toBe("partial");

    await page.goto(
      `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(registrationId!)}`,
      { waitUntil: "domcontentloaded" }
    );
    const firstReload = await page.reload({ waitUntil: "domcontentloaded" });
    expect(firstReload?.status()).toBe(200);
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-due-paid]")).toBeVisible();

    const firstPaymentAfterApproval = (await readPayments(adminPage, registrationId!)).find(
      (payment) => payment.id === firstPayment!.id
    );
    expect(firstPaymentAfterApproval?.status).toBe("Paid");
    expect(await readRosterRow(adminPage, tourId, registrationId!)).toMatchObject({
      guestLabel: expect.stringContaining(guestName),
      status: "approved",
      paymentStatus: "partial",
      partySize: 1,
    });
    const partialXlsx = await readXlsxFinancialState(adminPage, tourId, guestName);
    expect(partialXlsx.followupContainsGuest).toBe(true);
    expect(partialXlsx.paidContainsGuest).toBe(false);

    const secondReceipt = await uploadMemberReceipt(page, registrationId!, "final-balance");
    const paymentsAfterSecondReceipt = await readPayments(adminPage, registrationId!);
    const secondPayment = paymentsAfterSecondReceipt.find(
      (payment) =>
        payment.registrationId === registrationId &&
        payment.amount === secondAmount &&
        payment.id === secondReceipt.paymentId
    );
    expect(secondPayment).toMatchObject({
      registrationId,
      amount: secondAmount,
      method: "Manual",
      provider: "manual",
      status: "Pending",
      paidAt: null,
    });
    await reviewReceiptInFinanceUi(
      adminPage,
      registrationId!,
      secondReceipt.receiptId,
      "exact",
      "paid"
    );

    const finalInvoice = await readInvoice(adminPage, registrationId!);
    expect(finalInvoice.paidAmountMinor).toBe(initialInvoice.invoiceTotalMinor);
    expect(finalInvoice.balanceDueMinor).toBe("0");
    const finalMember = await readMember(page, registrationId!);
    expect(finalMember?.status).toBe("approved");
    expect(finalMember?.paymentStatus).toBe("paid");

    const finalReload = await page.reload({ waitUntil: "domcontentloaded" });
    expect(finalReload?.status()).toBe(200);
    await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
      timeout: 60_000,
    });

    const finalPaymentListResponse = await adminPage.request.get(
      `/api/finance/payments?limit=50&registrationId=${encodeURIComponent(registrationId!)}`
    );
    const finalPaymentListText = await finalPaymentListResponse.text();
    expect(finalPaymentListResponse.ok(), finalPaymentListText).toBeTruthy();
    const finalPaymentRows =
      (JSON.parse(finalPaymentListText) as { items?: FinancePayment[] }).items ?? [];
    for (const expectedPayment of [firstPayment!, secondPayment!]) {
      expect(finalPaymentRows.find((payment) => payment.id === expectedPayment.id)).toMatchObject({
        status: "Paid",
        method: "Manual",
        provider: "manual",
      });
    }
    expect(await readRosterRow(adminPage, tourId, registrationId!)).toMatchObject({
      guestLabel: expect.stringContaining(guestName),
      status: "approved",
      paymentStatus: "paid",
      partySize: 1,
      transportKind: "primary",
    });
    const paidXlsx = await readXlsxFinancialState(adminPage, tourId, guestName);
    expect(paidXlsx.finalStatus).toBe("پرداخت کامل");
    expect(paidXlsx.followupContainsGuest).toBe(false);
    expect(paidXlsx.paidContainsGuest).toBe(true);
  });
});
