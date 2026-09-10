/**
 * Shared tour workspace E2E helpers (Denali dev smoke).
 */
import { expect, type Page } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../../src/features/bookings/bookings-command-center-types";
import { resolveChainSmokePublishedTourId } from "../../../test/fixtures/p6-chain-guest-api";

export const WORKSPACE_SMOKE_TOUR_ID = resolveChainSmokePublishedTourId();

export type WorkspaceBookingRow = {
  readonly id?: string;
  readonly guestLabel?: string;
  readonly status?: string;
  readonly paymentStatus?: string;
};

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function fetchWorkspaceBookingRows(
  page: Page,
  input: {
    readonly status: string;
    readonly paymentStatus?: "unpaid" | "partial" | "paid";
  }
): Promise<WorkspaceBookingRow[]> {
  const params = new URLSearchParams({
    tourId: WORKSPACE_SMOKE_TOUR_ID,
    status: input.status,
    view: "ops",
    limit: "50",
  });
  if (input.paymentStatus !== undefined) {
    params.set("paymentStatus", input.paymentStatus);
  }
  const listRes = await page.request.get(`/api/bookings?${params.toString()}`);
  expect(listRes.ok(), await listRes.text()).toBeTruthy();
  const body = (await listRes.json()) as { items?: WorkspaceBookingRow[] };
  return body.items ?? [];
}

export async function seedPendingUnpaidGuest(
  page: Page,
  stamp: number | string
): Promise<{ guestName: string; registrationId: string }> {
  const guestName = `WS Unpaid ${stamp}`;
  const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(WORKSPACE_SMOKE_TOUR_ID)}`);
  expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
  const tourBody = (await tourRes.json()) as {
    projection?: { title?: string | null; departureAt?: string | null };
  };
  const tourTitle = tourBody.projection?.title?.trim() ?? "";
  const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
  expect(tourTitle.length).toBeGreaterThan(0);
  expect(departureAt.length).toBeGreaterThan(0);

  const createRes = await page.request.post("/api/bookings", {
    headers: { "content-type": "application/json" },
    data: {
      tourId: WORKSPACE_SMOKE_TOUR_ID,
      tourTitle,
      guestLabel: guestName,
      guestEmail: `ws-unpaid-${stamp}@denali-smoke.local`,
      guestPhone: `+1555${String(stamp).replace(/\D/g, "").slice(-7)}`,
      partySize: 1,
      departureAt,
      registrationIntake: { registrantTarget: "other" },
    },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const registrationId = ((await createRes.json()) as { id?: string }).id?.trim() ?? "";
  expect(registrationId.length).toBeGreaterThan(0);
  return { guestName, registrationId };
}

export async function seedApprovedUnpaidGuest(
  page: Page,
  stamp: number | string
): Promise<{ guestName: string; registrationId: string }> {
  const guestName = `WS Approved Unpaid ${stamp}`;
  const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(WORKSPACE_SMOKE_TOUR_ID)}`);
  expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
  const tourBody = (await tourRes.json()) as {
    projection?: { title?: string | null; departureAt?: string | null };
  };
  const tourTitle = tourBody.projection?.title?.trim() ?? "";
  const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
  expect(tourTitle.length).toBeGreaterThan(0);
  expect(departureAt.length).toBeGreaterThan(0);

  const createRes = await page.request.post("/api/bookings", {
    headers: { "content-type": "application/json" },
    data: {
      tourId: WORKSPACE_SMOKE_TOUR_ID,
      tourTitle,
      guestLabel: guestName,
      guestEmail: `ws-approved-unpaid-${stamp}@denali-smoke.local`,
      guestPhone: `+1555${String(stamp).replace(/\D/g, "").slice(-7)}`,
      partySize: 1,
      departureAt,
      registrationIntake: { registrantTarget: "other" },
    },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const registrationId = ((await createRes.json()) as { id?: string }).id?.trim() ?? "";
  expect(registrationId.length).toBeGreaterThan(0);

  const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

  const overrideRes = await page.request.put(
    `/api/finance/registrations/${registrationId}/obligation-override`,
    {
      headers: { "content-type": "application/json" },
      data: {
        obligationMinor: "1000000",
        reason: "Workspace smoke approved unpaid seed",
      },
    }
  );
  expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();

  return { guestName, registrationId };
}

export function financeWorkspacePath(registrationId: string): string {
  return `/tours/${WORKSPACE_SMOKE_TOUR_ID}/workspace?tab=finance&focusRegistrationId=${encodeURIComponent(
    registrationId
  )}`;
}

export async function openFinanceWorkspaceGuest(
  page: Page,
  input: { readonly registrationId: string; readonly guestName: string }
): Promise<void> {
  const pendingReceiptsResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/finance/receipts/pending") &&
      response.request().method() === "GET" &&
      response.ok(),
    { timeout: 90_000 }
  );
  await page.goto(financeWorkspacePath(input.registrationId), {
    waitUntil: "domcontentloaded",
  });
  await pendingReceiptsResponse;

  const guestButton = page.getByRole("button", {
    name: new RegExp(escapeRegExp(input.guestName), "i"),
  });
  if (await guestButton.isVisible().catch(() => false)) {
    await guestButton.click();
  }
}

export async function seedPendingPaidGuest(
  page: Page,
  stamp: number
): Promise<{ guestName: string; registrationId: string }> {
  const guestName = `WS Paid Pending ${stamp}`;
  const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(WORKSPACE_SMOKE_TOUR_ID)}`);
  expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
  const tourBody = (await tourRes.json()) as {
    projection?: { title?: string | null; departureAt?: string | null };
  };
  const tourTitle = tourBody.projection?.title?.trim() ?? "";
  const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
  expect(tourTitle.length).toBeGreaterThan(0);
  expect(departureAt.length).toBeGreaterThan(0);

  const createRes = await page.request.post("/api/bookings", {
    headers: { "content-type": "application/json" },
    data: {
      tourId: WORKSPACE_SMOKE_TOUR_ID,
      tourTitle,
      guestLabel: guestName,
      guestEmail: `ws-paid-${stamp}@denali-smoke.local`,
      guestPhone: `+1555${String(stamp).slice(-7)}`,
      partySize: 1,
      departureAt,
      paymentStatus: "paid",
      registrationIntake: { registrantTarget: "other" },
    },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const registrationId = ((await createRes.json()) as { id?: string }).id?.trim() ?? "";
  expect(registrationId.length).toBeGreaterThan(0);
  return { guestName, registrationId };
}

export async function openWorkspaceGuestRow(page: Page, guestName: string): Promise<void> {
  const guestRow = page
    .locator("[data-booking-row]")
    .filter({ hasText: new RegExp(escapeRegExp(guestName), "i") });
  await expect(guestRow).toBeVisible({ timeout: 60_000 });
  await guestRow
    .locator(`[data-testid^="${BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxRow}-"]`)
    .click();
}

/** Free tour capacity by cancelling smoke bookings (memory-driver E2E hygiene). */
export async function ensureTourHasApprovalCapacity(
  page: Page,
  input: { readonly minFreePartySlots: number }
): Promise<void> {
  const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(WORKSPACE_SMOKE_TOUR_ID)}`);
  if (!tourRes.ok()) {
    return;
  }
  const tourBody = (await tourRes.json()) as {
    projection?: { acceptedCount?: number; totalCapacity?: number | null };
  };
  const accepted = tourBody.projection?.acceptedCount ?? 0;
  const capacity = tourBody.projection?.totalCapacity ?? null;
  if (capacity === null || capacity <= 0) {
    return;
  }
  const freeSlots = capacity - accepted;
  if (freeSlots >= input.minFreePartySlots) {
    return;
  }

  const smokePattern =
    /^(WS |Scenario|P3 |GAP |BQC |P6 Chain|Test Guest|WS Inspect|WS Inline|WS Approved Unpaid|WS Unpaid|WS Paid)/i;
  let slotsNeeded = input.minFreePartySlots - freeSlots;

  const cancelSmokeRows = async (status: "approved" | "pending"): Promise<void> => {
    if (slotsNeeded <= 0) {
      return;
    }
    const listRes = await page.request.get(
      `/api/bookings?tourId=${encodeURIComponent(WORKSPACE_SMOKE_TOUR_ID)}&status=${status}&view=ops&limit=100`
    );
    if (!listRes.ok()) {
      return;
    }
    const listBody = (await listRes.json()) as {
      items?: Array<{ id?: string; guestLabel?: string; partySize?: number }>;
    };
    for (const row of listBody.items ?? []) {
      if (slotsNeeded <= 0) {
        break;
      }
      const id = row.id?.trim() ?? "";
      const label = row.guestLabel?.trim() ?? "";
      if (id.length === 0 || !smokePattern.test(label)) {
        continue;
      }
      const endpoint =
        status === "pending" ? `/api/bookings/${id}/reject` : `/api/bookings/${id}/cancel`;
      const actionRes = await page.request.post(endpoint, {
        headers: { "content-type": "application/json" },
        data: status === "pending" ? { reason: "E2E capacity hygiene" } : undefined,
      });
      if (actionRes.ok()) {
        slotsNeeded -= row.partySize ?? 1;
      }
    }
  };

  await cancelSmokeRows("approved");
  await cancelSmokeRows("pending");
}

export async function clickWorkspaceApproveAndWait(
  page: Page,
  registrationId: string
): Promise<void> {
  const approveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/bookings/${registrationId}/approve`) &&
      response.request().method() === "POST"
  );
  await page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton).click();
  const overbook = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.overbookConfirmDialog);
  if (await overbook.isVisible().catch(() => false)) {
    await overbook.getByRole("button", { name: /باز هم تأیید|overbook/i }).click();
  }
  const res = await approveResponse;
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function clickWorkspaceApproveWithoutPaymentAndWait(
  page: Page,
  registrationId: string
): Promise<void> {
  const approveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/bookings/${registrationId}/approve`) &&
      response.request().method() === "POST"
  );
  const overrideResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/finance/registrations/${registrationId}/obligation-override`) &&
      response.request().method() === "PUT"
  );
  await page
    .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveWithoutPaymentButton)
    .click();
  const overbook = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.overbookConfirmDialog);
  if (await overbook.isVisible().catch(() => false)) {
    await overbook.getByRole("button", { name: /باز هم تأیید|overbook/i }).click();
  }
  const approveRes = await approveResponse;
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
  const overrideRes = await overrideResponse;
  expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();
}
