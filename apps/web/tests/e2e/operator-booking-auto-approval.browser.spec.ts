/**
 * TC-BOOK-A — Denali auto-approval vs manual approval tour policy (W2).
 */
import { expect, test, type Page } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { publishTourFromFlatEdit } from "../../test/fixtures/tour-creation-publication-fixture";
import {
  captureBookingDeskArtifact,
  DENALI_PUBLISHED_TOUR_ID,
  DENALI_SMOKE_TENANT_ID,
  tourOpsApiBase,
} from "./fixtures/operator-booking-desk";
import { loginDenaliOperatorOwner } from "./fixtures/authenticate-denali-operator-for-engagement";

const DENALI_CLONE_SOURCE_TOUR_ID = DENALI_PUBLISHED_TOUR_ID;

async function patchTourCanonicalData(
  page: Page,
  tourId: string,
  mutate: (data: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
  expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
  const tour = (await tourRes.json()) as {
    rowVersion?: number;
    canonical?: {
      schemaVersion?: number;
      roots?: readonly string[];
      data?: Record<string, unknown>;
    };
  };
  const data = mutate({ ...(tour.canonical?.data ?? {}) });
  const patchRes = await page.request.patch(`/api/tours/${encodeURIComponent(tourId)}`, {
    data: {
      rowVersion: tour.rowVersion ?? 1,
      schemaVersion: tour.canonical?.schemaVersion ?? 1,
      roots: tour.canonical?.roots ?? Object.keys(data),
      data,
    },
  });
  expect(patchRes.ok(), await patchRes.text()).toBeTruthy();
}

async function patchTourRegistrationApproval(
  page: Page,
  tourId: string,
  mode: "manual" | "auto",
): Promise<void> {
  await patchTourCanonicalData(page, tourId, (data) => {
    const pricing =
      data.pricing != null && typeof data.pricing === "object" && !Array.isArray(data.pricing)
        ? { ...(data.pricing as Record<string, unknown>) }
        : {};
    pricing.registrationApproval = mode;
    return { ...data, pricing };
  });

  const verify = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
  expect(verify.ok()).toBeTruthy();
  const verifyBody = (await verify.json()) as {
    canonical?: { data?: { pricing?: { registrationApproval?: string } } };
  };
  expect(verifyBody.canonical?.data?.pricing?.registrationApproval).toBe(mode);
}

async function publishTourWithApprovalMode(
  page: Page,
  title: string,
  mode: "manual" | "auto",
): Promise<string> {
  await loginDenaliOperatorOwner(page);
  const cloneRes = await page.request.post(
    `/api/tours/${encodeURIComponent(DENALI_CLONE_SOURCE_TOUR_ID)}/clone`,
    { data: {} },
  );
  expect(cloneRes.ok(), await cloneRes.text()).toBeTruthy();
  const tourId = ((await cloneRes.json()) as { id?: string }).id?.trim() ?? "";
  expect(tourId.length).toBeGreaterThan(0);

  await patchTourCanonicalData(page, tourId, (data) => ({
    ...data,
    title,
    basics: { title },
    publishStatus: "draft",
  }));
  await publishTourFromFlatEdit(page, tourId);
  await patchTourRegistrationApproval(page, tourId, mode);
  return tourId;
}

async function seedGuestOnTour(
  page: Page,
  input: { tourId: string; guestName: string; email: string; partySize?: number },
): Promise<{ bookingId: string; status: string }> {
  const res = await page.request.post(`${tourOpsApiBase()}/denali/registrations`, {
    headers: {
      "x-tenant-id": DENALI_SMOKE_TENANT_ID,
      "content-type": "application/json",
    },
    data: {
      tourId: input.tourId,
      registrantTarget: "other",
      contact: { email: input.email, fullName: input.guestName, phone: `+1555${String(Date.now()).slice(-7)}` },
      partySize: input.partySize ?? 1,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { data?: { id?: string; status?: string } };
  const bookingId = body.data?.id?.trim() ?? "";
  const status = body.data?.status?.trim() ?? "";
  expect(bookingId.length).toBeGreaterThan(0);
  return { bookingId, status };
}

async function openBookingsWithStatus(page: Page, status: string): Promise<void> {
  await page.goto(`/bookings?status=${encodeURIComponent(status)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("operator booking auto-approval — TC-BOOK-A", () => {
  test.setTimeout(300_000);

  test("TC-BOOK-A01 manual tour → guest register stays pending in work queue", async ({
    page,
  }) => {
    const stamp = Date.now();
    const title = `BQC Manual Approve ${stamp}`;
    const guestName = `BQC Manual Guest ${stamp}`;
    const tourId = await publishTourWithApprovalMode(page, title, "manual");
    const { bookingId, status } = await seedGuestOnTour(page, {
      tourId,
      guestName,
      email: `bqc-manual-${stamp}@denali.local`,
    });
    expect(status).toBe("pending");

    await openBookingsWithStatus(page, "actionable");
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.locator(`[data-testid^="${BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxRow}-"]`).click();
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toBeVisible();

    const bookingRes = await page.request.get(`/api/bookings/${bookingId}`);
    expect(bookingRes.ok()).toBeTruthy();
    const bookingBody = (await bookingRes.json()) as { status?: string };
    expect(bookingBody.status).toBe("pending");
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-a01-manual-tour-pending.png");
  });

  test("TC-BOOK-A02 auto tour → guest register auto-approved", async ({ page }) => {
    const stamp = Date.now();
    const title = `BQC Auto Approve ${stamp}`;
    const guestName = `BQC Auto Guest ${stamp}`;
    const tourId = await publishTourWithApprovalMode(page, title, "auto");
    const { bookingId, status } = await seedGuestOnTour(page, {
      tourId,
      guestName,
      email: `bqc-auto-${stamp}@denali.local`,
    });
    expect(status).toBe("approved");

    await openBookingsWithStatus(page, "approved");
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.locator(`[data-testid^="${BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxRow}-"]`).click();
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toHaveCount(0);

    const bookingRes = await page.request.get(`/api/bookings/${bookingId}`);
    expect(bookingRes.ok()).toBeTruthy();
    const bookingBody = (await bookingRes.json()) as { status?: string; paymentStatus?: string };
    expect(bookingBody.status).toBe("approved");
    expect(bookingBody.paymentStatus).toBe("unpaid");
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-a02-auto-tour-approved.png");
  });

  test("TC-BOOK-A03 tour workspace register desk for manual vs auto tours", async ({ page }) => {
    const stamp = Date.now();
    const manualTitle = `BQC Desk Manual ${stamp}`;
    const autoTitle = `BQC Desk Auto ${stamp}`;
    const manualTourId = await publishTourWithApprovalMode(page, manualTitle, "manual");
    const autoTourId = await publishTourWithApprovalMode(page, autoTitle, "auto");

    await page.goto(`/tours/${encodeURIComponent(manualTourId)}/workspace`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-a03-workspace-manual-tour.png");

    await page.goto(`/tours/${encodeURIComponent(autoTourId)}/workspace`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-a03-workspace-auto-tour.png");
  });
});
