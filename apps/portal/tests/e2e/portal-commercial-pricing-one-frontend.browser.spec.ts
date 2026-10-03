import { expect, test } from "@playwright/test";

import {
  DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID,
  DENALI_BOOKING_PAID_AUTO_TOUR_ID,
  completePortalCatalogRegistration,
} from "./fixtures/complete-portal-registration";
import {
  openMemberRegistrationDetailByTitle,
  openMemberRegistrationsFromSuccess,
} from "./fixtures/portal-member-navigation";

const API_BASE = process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001";
const OPERATOR_HEADERS = {
  "x-tenant-id": "00000000-0000-4000-8000-000000000014",
  "x-authenticated-tenant-id": "00000000-0000-4000-8000-000000000014",
  "x-user-id": "00000000-0000-4000-8000-000000000101",
  "x-actor-role": "owner",
  "x-membership-status": "ACTIVE",
  "x-workspace-id": "ws-operator-smoke",
};

async function readInvoice(page: import("@playwright/test").Page, registrationId: string) {
  const response = await page.request.get(
    `${API_BASE}/finance/invoices/${encodeURIComponent(registrationId)}`,
    { headers: OPERATOR_HEADERS },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { invoiceTotalMinor?: string; balanceDueMinor?: string };
}

test("COMMERCIAL-BROWSER member discount is applied to the canonical invoice", async ({ page }) => {
  const stamp = Date.now();
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID,
    email: `commercial-member-${stamp}@denali-smoke.local`,
    fullName: `Commercial member ${stamp}`,
    phone: "+15550001003",
    nationalId: "1000000001",
    registrantTarget: "self",
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid auto member discount");
  const registrationId = page.url().match(/\/me\/registrations\/([^/?#]+)/)?.[1];
  expect(registrationId).toBeTruthy();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
  const invoice = await readInvoice(page, registrationId!);
  expect(invoice.invoiceTotalMinor).toBe("2000000");
  expect(invoice.balanceDueMinor).toBe("2000000");
});

test("COMMERCIAL-BROWSER closed discount gate keeps the base invoice", async ({ page }) => {
  const stamp = Date.now();
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
    email: `commercial-base-${stamp}@denali-smoke.local`,
    fullName: `Commercial base ${stamp}`,
    phone: "+15550001003",
    guestPhone: `+1555${String(stamp).slice(-7)}`,
    nationalId: "1000000001",
    registrantTarget: "other",
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid auto booking");
  const registrationId = page.url().match(/\/me\/registrations\/([^/?#]+)/)?.[1];
  expect(registrationId).toBeTruthy();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
  const invoice = await readInvoice(page, registrationId!);
  expect(invoice.invoiceTotalMinor).toBe("2500000");
  expect(invoice.balanceDueMinor).toBe("2500000");
});
