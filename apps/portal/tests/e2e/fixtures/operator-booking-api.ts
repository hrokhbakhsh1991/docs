/**
 * Operator booking API helpers for cross-surface portal BOOK-BQC tests.
 * Portal smoke stack does not start @apps/web — transitions use API directly (partial realness).
 */
import { expect, type APIRequestContext } from "@playwright/test";

import { createOperatorEngagementApiContext } from "./operator-engagement-api";

export async function createOperatorBookingApiContext(): Promise<APIRequestContext> {
  return createOperatorEngagementApiContext();
}

export async function operatorApproveBooking(
  operatorApi: APIRequestContext,
  registrationId: string,
): Promise<void> {
  const res = await operatorApi.post(`/bookings/${encodeURIComponent(registrationId)}/approve`, {
    timeout: 120_000,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function operatorRejectBooking(
  operatorApi: APIRequestContext,
  registrationId: string,
  input?: { readonly reason?: string },
): Promise<void> {
  const res = await operatorApi.post(`/bookings/${encodeURIComponent(registrationId)}/reject`, {
    data: input?.reason ? { reason: input.reason } : {},
    timeout: 120_000,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}
