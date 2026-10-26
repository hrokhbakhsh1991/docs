/**
 * BQC — Tour creation closure gaps (member reg, PDP parity, viewer, tenant, LTR, export).
 */
import { expect, test, type Page } from "@playwright/test";

import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";
import { resolveDenaliWizardDestination } from "../../test/fixtures/denali-itinerary-wizard-fixture";
import {
  createDenaliMultiDayDraftTour,
  expectDraftCanonicalFieldsPersisted,
  expectFlatEditShowsTitle,
  openFlatEditForTour,
  prepareDenaliTourWizard,
  publishTourFromFlatEdit,
} from "../../test/fixtures/tour-creation-publication-fixture";
import {
  assertDenaliTenantCannotAccessOperatorTour,
  assertNoTourExportControls,
  assertViewerCannotMutateTour,
  completePortalRegistrationForTour,
  fetchMarketingCatalogListItem,
  fetchMarketingCatalogTour,
  openMarketingTourDetail,
  publishTourForClosure,
  readCanonicalBasePriceMinor,
  readCanonicalItineraryDayCount,
  readCanonicalPeakHeight,
  setOperatorLocale,
  PORTAL_OPERATOR_BASE_URL,
} from "../../test/fixtures/tour-creation-closure-fixture";
import {
  operatorApproveBookingViaUi,
  withOperatorBookingsUi,
} from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

async function registerClosureMember(
  page: Page,
  tourId: string,
  tourTitle: string,
  input: { readonly phone: string; readonly fullName: string }
): Promise<string> {
  await completePortalRegistrationForTour(page, tourId, input);
  await page.goto(`${PORTAL_OPERATOR_BASE_URL}/me/registrations`, {
    waitUntil: "domcontentloaded",
  });
  const detailLink = page
    .locator("[data-portal-member-registrations-list] a")
    .filter({ hasText: tourTitle })
    .first();
  await expect(detailLink).toBeVisible({ timeout: 60_000 });
  const href = await detailLink.getAttribute("href");
  const registrationId = href?.match(/\/me\/registrations\/([^/?#]+)/)?.[1];
  expect(
    registrationId,
    `member entry for ${tourTitle} must link to its registration`
  ).toBeTruthy();
  return registrationId!;
}

async function readClosureMemberRegistration(
  page: Page,
  registrationId: string
): Promise<{
  readonly status?: string;
  readonly cancelSource?: string;
  readonly paymentDueAt?: string;
}> {
  const response = await page.request.get(
    `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId)}`
  );
  expect(response.ok(), `member registration read failed (${response.status()})`).toBeTruthy();
  const body = (await response.json()) as {
    data?: { status?: string; cancelSource?: string; paymentDueAt?: string };
  };
  return body.data ?? {};
}

test.describe("tour-creation-closure.spec.ts", () => {
  test.setTimeout(360_000);

  test("TC-CL-REG-01 created tour registration reaches operator approval and member state", async ({
    page,
    browser,
  }) => {
    const stamp = Date.now();
    const title = `TC-CL-REG ${stamp}`;
    const phone = `+1555${String(stamp).slice(-7)}`;
    const guestName = `Closure Registration Guest ${String(stamp).slice(-6)}`;
    const { tourId } = await publishTourForClosure(page, title, {
      pricing: {
        paymentCollection: "paid",
        registrationApproval: "manual",
        basePriceToman: "500000",
      },
    });
    const catalogTour = await fetchMarketingCatalogTour(page, tourId);
    expect(catalogTour.priceAmount).toBe(500_000);

    await completePortalRegistrationForTour(page, tourId, {
      phone,
      fullName: guestName,
      rapidDoubleClick: true,
    });

    // A second tab in the same member session must discover the existing
    // registration instead of offering a second self-registration. Exercise
    // browser history too: returning to the form must keep that guard intact.
    const replayPage = await page.context().newPage();
    try {
      await replayPage.goto(
        `${PORTAL_OPERATOR_BASE_URL}/catalog/${encodeURIComponent(tourId)}/register`,
        { waitUntil: "domcontentloaded" }
      );
      const existingRegistration = replayPage.locator("[data-registration-self-already-detail]");
      await expect(existingRegistration).toBeVisible({ timeout: 60_000 });
      const existingRegistrationHref = await existingRegistration.getAttribute("href");
      expect(existingRegistrationHref).toMatch(/^\/me\/registrations\//);

      await existingRegistration.click();
      await expect(replayPage.locator("[data-portal-member-registration-detail]")).toBeVisible({
        timeout: 60_000,
      });
      const replayDetailUrl = replayPage.url();
      await replayPage.goBack();
      await expect(replayPage.locator("[data-registration-self-already-detail]")).toBeVisible({
        timeout: 60_000,
      });
      await replayPage.goForward();
      await expect(replayPage.locator("[data-portal-member-registration-detail]")).toBeVisible({
        timeout: 60_000,
      });
      expect(replayPage.url()).toBe(replayDetailUrl);
    } finally {
      await replayPage.close();
    }

    await page.goto(`${PORTAL_OPERATOR_BASE_URL}/me/registrations`, {
      waitUntil: "domcontentloaded",
    });
    const memberTourLink = page
      .locator("[data-portal-member-registrations-list] a")
      .filter({ hasText: title })
      .first();
    await expect(memberTourLink).toBeVisible({ timeout: 60_000 });
    const memberDetailHref = await memberTourLink.getAttribute("href");
    expect(memberDetailHref).toBeTruthy();
    await page.goto(new URL(memberDetailHref!, PORTAL_OPERATOR_BASE_URL).toString(), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();

    const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
    const registrationId = registrationMatch?.[1];
    expect(registrationId, "member detail URL must expose registration id").toBeTruthy();

    await withOperatorBookingsUi(browser, async (adminPage) => {
      await operatorApproveBookingViaUi(adminPage, {
        guestLabel: guestName,
        bookingId: registrationId!,
      });

      const registrationsRes = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(registrationsRes.ok(), await registrationsRes.text()).toBeTruthy();
      const registrations = (await registrationsRes.json()) as {
        items?: readonly {
          id?: string;
          guestLabel?: string;
          status?: string;
        }[];
      };
      const registration = (registrations.items ?? []).find((row) => row.id === registrationId);
      expect(registration?.guestLabel).toContain(guestName);
      expect(registration?.status).toBe("approved");
      expect(
        (registrations.items ?? []).filter((row) => row.guestLabel?.includes(guestName))
      ).toHaveLength(1);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
        timeout: 60_000,
      });
      await page.locator("[data-portal-member-receipt-note]").fill("پرداخت آزمایشی closure");
      await page.locator("#receipt-file").setInputFiles({
        name: "tc-cl-reg-manual-receipt.png",
        mimeType: "image/png",
        buffer: Buffer.from("tc-cl-reg-manual-receipt"),
      });
      const [receiptResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname.endsWith("/receipt"),
          { timeout: 30_000 }
        ),
        page.locator("[data-portal-member-receipt-submit]").click(),
      ]);
      expect(receiptResponse.status(), await receiptResponse.text()).toBe(201);
      await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
        timeout: 60_000,
      });

      await adminPage.goto(
        `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
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
      const approvalResponse = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes("/api/finance/receipts/") &&
          response.url().endsWith("/review")
      );
      await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
      const approvedReceipt = await approvalResponse;
      expect(approvedReceipt.status(), await approvedReceipt.text()).toBe(200);
      await expect(receiptRow).toHaveCount(0, { timeout: 60_000 });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible();
    await expect(page.locator("[data-portal-member-detail-status-badge]")).toContainText(
      /تأیید شده|approved/i
    );
    await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("TC-CL-REG-04 auto-approved paid registration reaches final payment after receipt review", async ({
    page,
    browser,
  }) => {
    const stamp = Date.now();
    const title = `TC-CL-REG auto paid ${stamp}`;
    const guestName = `Auto Paid Guest ${String(stamp).slice(-6)}`;
    const { tourId } = await publishTourForClosure(page, title, {
      pricing: {
        paymentCollection: "paid",
        registrationApproval: "auto",
        basePriceToman: "500000",
      },
    });
    const registrationId = await registerClosureMember(page, tourId, title, {
      phone: `+1555${String(stamp).slice(-7)}`,
      fullName: guestName,
    });

    const initial = await readClosureMemberRegistration(page, registrationId);
    expect(initial.status).toBe("approved");
    expect(initial.paymentDueAt).toBeTruthy();
    await page.goto(
      `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await page
      .locator("[data-portal-member-receipt-note]")
      .fill("رسید ساختگی تست؛ هیچ وجهی منتقل نشده است");
    await page.locator("#receipt-file").setInputFiles({
      name: "tc-cl-reg-auto-paid.png",
      mimeType: "image/png",
      buffer: Buffer.from("tc-cl-reg-auto-paid-receipt"),
    });
    const [receiptResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith("/receipt"),
        { timeout: 30_000 }
      ),
      page.locator("[data-portal-member-receipt-submit]").click(),
    ]);
    expect(receiptResponse.status(), await receiptResponse.text()).toBe(201);
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });

    await withOperatorBookingsUi(browser, async (adminPage) => {
      await adminPage.goto(
        `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
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
      const approvalResponse = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes("/api/finance/receipts/") &&
          response.url().endsWith("/review")
      );
      await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
      const approvedReceipt = await approvalResponse;
      expect(approvedReceipt.status(), await approvedReceipt.text()).toBe(200);
      await expect(receiptRow).toHaveCount(0, { timeout: 60_000 });

      const rosterResponse = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
      const roster = (await rosterResponse.json()) as {
        items?: readonly { id?: string; status?: string; paymentStatus?: string }[];
      };
      expect((roster.items ?? []).find((row) => row.id === registrationId)).toMatchObject({
        status: "approved",
        paymentStatus: "paid",
      });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
      timeout: 60_000,
    });
    expect((await readClosureMemberRegistration(page, registrationId)).status).toBe("approved");
  });

  test("TC-CL-REG-03 text-only receipt rejection and file retry reach final payment", async ({
    page,
    browser,
  }) => {
    const stamp = Date.now();
    const title = `TC-CL-REG text retry ${stamp}`;
    const guestName = `Text Receipt Guest ${String(stamp).slice(-6)}`;
    const note = `رسید متنی آزمایشی ${String(stamp).slice(-6)}`;
    const { tourId } = await publishTourForClosure(page, title, {
      pricing: {
        paymentCollection: "paid",
        registrationApproval: "manual",
        basePriceToman: "500000",
      },
    });
    const registrationId = await registerClosureMember(page, tourId, title, {
      phone: `+1555${String(stamp).slice(-7)}`,
      fullName: guestName,
    });

    await page.goto(
      `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible({
      timeout: 60_000,
    });

    await withOperatorBookingsUi(browser, async (adminPage) => {
      await operatorApproveBookingViaUi(adminPage, {
        guestLabel: guestName,
        bookingId: registrationId,
      });

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
        timeout: 60_000,
      });
      const receiptFile = page.locator("#receipt-file");
      expect(
        await receiptFile.evaluate((element: HTMLInputElement) => element.files?.length ?? 0)
      ).toBe(0);
      await page.locator("[data-portal-member-receipt-note]").fill(note);
      const [textReceiptResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname.endsWith("/receipt"),
          { timeout: 30_000 }
        ),
        page.locator("[data-portal-member-receipt-submit]").click(),
      ]);
      expect(textReceiptResponse.status(), await textReceiptResponse.text()).toBe(201);
      const textReceipt = (await textReceiptResponse.json()) as {
        fileKey?: string | null;
      };
      expect(textReceipt.fileKey ?? null).toBeNull();
      // The portal BFF response is intentionally minimal; Finance's rendered receipt row
      // below proves the note crossed the API boundary and was persisted.
      await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
        timeout: 60_000,
      });

      const financeUrl = `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`;
      await adminPage.goto(financeUrl, { waitUntil: "domcontentloaded" });
      await expect(adminPage.getByTestId("finance-receipts-panel")).toBeVisible({
        timeout: 60_000,
      });
      const receiptRow = adminPage
        .getByTestId("finance-receipts-list")
        .getByRole("listitem")
        .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
      await expect(receiptRow).toContainText(note, { timeout: 60_000 });
      await expect(receiptRow.getByTestId("finance-receipt-text-only")).toBeVisible();
      const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
      await reviewForm.getByRole("textbox").fill("تصویر رسید هم لازم است");
      const [rejectionResponse] = await Promise.all([
        adminPage.waitForResponse(
          (response) =>
            response.request().method() === "PATCH" &&
            response.url().includes("/api/finance/receipts/") &&
            response.url().endsWith("/review")
        ),
        reviewForm.getByRole("button", { name: /reject|رد/i }).click(),
      ]);
      expect(rejectionResponse.status(), await rejectionResponse.text()).toBe(200);
      expect(((await rejectionResponse.json()) as { status?: string }).status).toBe("Rejected");
      await expect(receiptRow).toHaveCount(0, { timeout: 60_000 });

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-portal-member-receipt-rejected-hint]")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
      await page.locator("[data-portal-member-receipt-note]").fill("");
      await receiptFile.setInputFiles({
        name: "tc-cl-reg-text-retry.png",
        mimeType: "image/png",
        buffer: Buffer.from("tc-cl-reg-text-retry-proof"),
      });
      const [fileRetryResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname.endsWith("/receipt"),
          { timeout: 30_000 }
        ),
        page.locator("[data-portal-member-receipt-submit]").click(),
      ]);
      expect(fileRetryResponse.status(), await fileRetryResponse.text()).toBe(201);
      await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
        timeout: 60_000,
      });

      await adminPage.goto(financeUrl, { waitUntil: "domcontentloaded" });
      const retryRow = adminPage
        .getByTestId("finance-receipts-list")
        .getByRole("listitem")
        .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
      const retryReviewForm = retryRow.getByTestId("finance-receipt-review-form");
      await expect(retryReviewForm).toBeVisible({ timeout: 60_000 });
      await expect(retryRow.getByTestId("finance-receipt-proof-toggle")).toBeVisible();
      const approvalResponse = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes("/api/finance/receipts/") &&
          response.url().endsWith("/review")
      );
      await retryReviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
      const approvedReceipt = await approvalResponse;
      expect(approvedReceipt.status(), await approvedReceipt.text()).toBe(200);
      await expect(retryRow).toHaveCount(0, { timeout: 60_000 });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
      timeout: 60_000,
    });
    const memberRegistration = await readClosureMemberRegistration(page, registrationId);
    expect(memberRegistration.status).toBe("approved");
  });

  test("TC-CL-REG-05 concurrent members at capacity one yield one approved and one waitlisted", async ({
    page,
    browser,
  }) => {
    const stamp = Date.now();
    const title = `TC-CL-REG concurrent capacity ${stamp}`;
    const guests = [
      { phone: `+1555${String(stamp).slice(-7)}`, fullName: `Race Member A ${stamp}` },
      { phone: `+1555${String(stamp + 1).slice(-7)}`, fullName: `Race Member B ${stamp}` },
    ] as const;
    const { tourId } = await publishTourForClosure(page, title, {
      capacityMax: 1,
      pricing: { paymentCollection: "free", registrationApproval: "auto" },
    });
    const contexts = await Promise.all(
      guests.map(() => browser.newContext({ baseURL: PORTAL_OPERATOR_BASE_URL }))
    );
    const memberPages = await Promise.all(contexts.map((context) => context.newPage()));

    try {
      const registrationIds = await Promise.all(
        memberPages.map((memberPage, index) =>
          registerClosureMember(memberPage, tourId, title, guests[index]!)
        )
      );
      const statuses = await Promise.all(
        memberPages.map((memberPage, index) =>
          readClosureMemberRegistration(memberPage, registrationIds[index]!)
        )
      );
      expect(statuses.map((entry) => entry.status).sort()).toEqual(["approved", "waitlisted"]);

      const rosterResponse = await page.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
      const roster = (await rosterResponse.json()) as {
        items?: readonly { id?: string; status?: string; partySize?: number }[];
      };
      const racedRows = registrationIds.map((id) =>
        (roster.items ?? []).find((row) => row.id === id)
      );
      expect(racedRows).toHaveLength(2);
      expect(racedRows.filter((row) => row?.status === "approved")).toHaveLength(1);
      expect(racedRows.filter((row) => row?.status === "waitlisted")).toHaveLength(1);
      expect(
        racedRows
          .filter((row) => row?.status === "approved")
          .reduce((sum, row) => sum + (row?.partySize ?? 0), 0)
      ).toBe(1);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });

  test("TC-CL-VEHICLE-01 shared-car wizard publishes dong rules used by member registration", async ({
    page,
    browser,
  }) => {
    const stamp = Date.now();
    const title = `TC-CL-VEHICLE shared cars ${stamp}`;
    const phone = `+1555${String(stamp).slice(-7)}`;
    const guestName = `Shared Car Guest ${String(stamp).slice(-6)}`;
    const { tourId, canonical } = await publishTourForClosure(page, title, {
      capacityMax: 4,
      pricing: { paymentCollection: "free", registrationApproval: "auto" },
      transport: { mode: "shared_cars", dongAmountToman: "100000" },
    });

    expect(canonical.transport).toMatchObject({ mode: "shared_cars", dongAmount: 100_000 });
    const catalogTour = await fetchMarketingCatalogTour(page, tourId);
    expect(catalogTour.transport).toMatchObject({ mode: "shared_cars", dongAmount: 100_000 });

    const registrationPost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/api/catalog/registrations"),
      { timeout: 90_000 }
    );
    const registrationId = await registerClosureMember(page, tourId, title, {
      phone,
      fullName: guestName,
    });
    const registrationBody = JSON.parse((await registrationPost).postData() ?? "{}") as {
      transport?: { kind?: string };
    };
    expect(registrationBody.transport?.kind).toBe("no_car_dong");
    expect((await readClosureMemberRegistration(page, registrationId)).status).toBe("approved");

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
          partySize?: number;
        }[];
      };
      expect((roster.items ?? []).find((row) => row.id === registrationId)).toMatchObject({
        guestLabel: expect.stringContaining(guestName),
        status: "approved",
        partySize: 1,
      });
    });
  });

  test("TC-CL-REG-02 payment expiry promotes only the oldest waitlisted member across surfaces", async ({
    page,
    browser,
  }) => {
    test.skip(
      process.env.TOUR_CLOSURE_PAYMENT_EXPIRY_E2E !== "true",
      "run with the isolated local payment-expiry harness enabled"
    );

    const stamp = Date.now();
    const title = `TC-CL-REG-02 ${stamp}`;
    const firstName = `Expiry Full Capacity ${stamp}`;
    const nextName = `Expiry First Waitlist ${stamp}`;
    const laterName = `Expiry Later Waitlist ${stamp}`;
    const { tourId, canonical } = await publishTourForClosure(page, title, {
      capacityMax: 1,
      pricing: {
        paymentCollection: "paid",
        registrationApproval: "auto",
        basePriceToman: "500000",
      },
    });
    expect(canonical.capacityMax).toBe(1);

    const contexts = await Promise.all([
      browser.newContext({ baseURL: PORTAL_OPERATOR_BASE_URL }),
      browser.newContext({ baseURL: PORTAL_OPERATOR_BASE_URL }),
      browser.newContext({ baseURL: PORTAL_OPERATOR_BASE_URL }),
    ]);
    const memberPages = await Promise.all(contexts.map((context) => context.newPage()));
    try {
      const firstId = await registerClosureMember(memberPages[0]!, tourId, title, {
        phone: `+1555${String(stamp).slice(-7)}`,
        fullName: firstName,
      });
      const nextId = await registerClosureMember(memberPages[1]!, tourId, title, {
        phone: `+1555${String(stamp + 1).slice(-7)}`,
        fullName: nextName,
      });
      const laterId = await registerClosureMember(memberPages[2]!, tourId, title, {
        phone: `+1555${String(stamp + 2).slice(-7)}`,
        fullName: laterName,
      });

      const adminRowsResponse = await page.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(adminRowsResponse.ok(), await adminRowsResponse.text()).toBeTruthy();
      const initialRows = (await adminRowsResponse.json()) as {
        items?: readonly { id?: string; status?: string; partySize?: number }[];
      };
      const rowFor = (id: string) => (initialRows.items ?? []).find((row) => row.id === id);
      expect(rowFor(firstId)).toMatchObject({ status: "approved", partySize: 1 });
      expect(rowFor(nextId)).toMatchObject({ status: "waitlisted", partySize: 1 });
      expect(rowFor(laterId)).toMatchObject({ status: "waitlisted", partySize: 1 });

      // Exercise the supported operator deadline extension API, then let the
      // deployed API scheduler expire that hold and promote the queue.
      const extended = await page.request.post(
        `/api/finance/payment-holds/${encodeURIComponent(firstId)}/extend`,
        { data: { newDueAt: new Date(Date.now() + 5_000).toISOString() } }
      );
      expect(extended.status(), await extended.text()).toBe(200);

      await expect
        .poll(async () => (await readClosureMemberRegistration(memberPages[0]!, firstId)).status, {
          // The staging scheduler's default first-tick interval is 60 seconds.
          timeout: 95_000,
          intervals: [250, 500, 1_000],
        })
        .toBe("cancelled");
      await expect
        .poll(async () => (await readClosureMemberRegistration(memberPages[1]!, nextId)).status, {
          timeout: 45_000,
          intervals: [250, 500, 1_000],
        })
        .toBe("approved");
      expect((await readClosureMemberRegistration(memberPages[0]!, firstId)).cancelSource).toBe(
        "payment_deadline"
      );
      expect(
        (await readClosureMemberRegistration(memberPages[1]!, nextId)).paymentDueAt
      ).toBeTruthy();
      expect((await readClosureMemberRegistration(memberPages[2]!, laterId)).status).toBe(
        "waitlisted"
      );

      await memberPages[0]!.goto(
        `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(firstId)}`,
        { waitUntil: "domcontentloaded" }
      );
      await expect(
        memberPages[0]!.locator(
          '[data-portal-member-receipt-closed][data-closed-reason="payment_expired"]'
        )
      ).toBeVisible({ timeout: 60_000 });
      await memberPages[1]!.goto(
        `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(nextId)}`,
        { waitUntil: "domcontentloaded" }
      );
      await expect(memberPages[1]!.locator("[data-portal-member-receipt-upload]")).toBeVisible({
        timeout: 60_000,
      });
      await memberPages[2]!.goto(
        `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(laterId)}`,
        { waitUntil: "domcontentloaded" }
      );
      await expect(
        memberPages[2]!.locator("[data-portal-member-receipt-awaiting-approval]")
      ).toBeVisible({ timeout: 60_000 });

      await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
      const firstRow = page.locator("[data-booking-row]").filter({ hasText: firstName });
      const nextRow = page.locator("[data-booking-row]").filter({ hasText: nextName });
      const laterRow = page.locator("[data-booking-row]").filter({ hasText: laterName });
      await expect(firstRow).toBeVisible({ timeout: 60_000 });
      await expect(firstRow).toContainText(/payment.*deadline|مهلت پرداخت|منقضی/i);
      await expect(nextRow).toBeVisible({ timeout: 60_000 });
      await expect(nextRow).toContainText(/approved|تأیید/i);
      await expect(laterRow).toBeVisible({ timeout: 60_000 });
      await expect(laterRow).toContainText(/waitlist|صف انتظار|در انتظار/i);

      const finalRowsResponse = await page.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(finalRowsResponse.ok(), await finalRowsResponse.text()).toBeTruthy();
      const finalRows = (await finalRowsResponse.json()) as {
        items?: readonly { id?: string; status?: string; partySize?: number }[];
      };
      const finalById = new Map((finalRows.items ?? []).map((row) => [row.id, row]));
      expect(finalById.get(firstId)).toMatchObject({ status: "cancelled", partySize: 1 });
      expect(finalById.get(nextId)).toMatchObject({ status: "approved", partySize: 1 });
      expect(finalById.get(laterId)).toMatchObject({ status: "waitlisted", partySize: 1 });
      const approvedPartySize = (finalRows.items ?? [])
        .filter((row) => row.status === "approved")
        .reduce((sum, row) => sum + (row.partySize ?? 0), 0);
      expect(approvedPartySize).toBeLessThanOrEqual(canonical.capacityMax ?? 0);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });

  test("TC-CL-PDP-01 marketing catalog parity matches operator canonical", async ({ page }) => {
    const title = `TC-CL-PDP ${Date.now()}`;
    const { tourId, canonical } = await publishTourForClosure(page, title);

    const listItem = await fetchMarketingCatalogListItem(page, tourId, title);
    expect(listItem).toBeDefined();
    expect(listItem?.title).toBe(title);
    expect(listItem?.category).toBe(canonical.category);

    const detail = await fetchMarketingCatalogTour(page, tourId);
    expect(detail.title).toBe(title);
    expect(detail.category).toBe(canonical.category);
    expect(detail.totalCapacity).toBe(canonical.capacityMax);
    expect(detail.peakHeightMeters).toBe(readCanonicalPeakHeight(canonical));
    expect(detail.itineraryDays?.length ?? 0).toBe(readCanonicalItineraryDayCount(canonical));

    const canonicalPrice = readCanonicalBasePriceMinor(canonical);
    if (canonicalPrice !== null) {
      expect(detail.priceAmount).toBe(canonicalPrice);
    }

    await openMarketingTourDetail(page, tourId, title);
    await expect(page.locator("[data-marketing-catalog-itinerary]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("[data-marketing-catalog-detail-destination]")).toBeVisible();
  });

  test("TC-CL-VIEWER-01 viewer cannot mutate tour in UI or API", async ({ page }) => {
    const title = `TC-CL-VIEWER ${Date.now()}`;
    const { tourId } = await publishTourForClosure(page, title);
    await assertViewerCannotMutateTour(page, tourId, title);
  });

  test("TC-CL-TENANT-01 denali tenant cannot read or patch operator tour", async ({ page }) => {
    const operatorHost = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost").host;
    const denaliHost = new URL(
      process.env.SMOKE_DENALI_ADMIN_BASE_URL ?? "http://denali.admin.localhost:3000"
    ).host;
    test.skip(
      operatorHost === denaliHost,
      "staging requires a distinct Denali host to prove cross-tenant isolation"
    );
    const title = `TC-CL-TENANT ${Date.now()}`;
    const { tourId } = await publishTourForClosure(page, title);
    await assertDenaliTenantCannotAccessOperatorTour(page, tourId, title);
  });

  test("TC-CL-LTR-01 English LTR create draft publish persists fields", async ({ page }) => {
    await setOperatorLocale(page, "en");
    const title = `TC-CL-LTR ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    const destination = await resolveDenaliWizardDestination(page);
    const tourId = await createDenaliMultiDayDraftTour(page, title, {
      destinationLabel: destination.name,
    });
    await expectDraftCanonicalFieldsPersisted(page, tourId, {
      title,
      category: "mountain_multi",
      capacityMax: 12,
      peakHeight: destination.altitudeM,
      itineraryDayCount: 3,
    });
    await publishTourFromFlatEdit(page, tourId);
    await openFlatEditForTour(page, tourId);
    await expectFlatEditShowsTitle(page, title);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible();
  });

  test("TC-CL-EXPORT-01 tour Excel/PDF export is not implemented", async ({ page }) => {
    const title = `TC-CL-EXPORT ${Date.now()}`;
    const { tourId } = await publishTourForClosure(page, title);
    await assertNoTourExportControls(page, tourId);
  });
});
