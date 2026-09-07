/**
 * MNI-001 — operator API helpers for shared notification browser journeys.
 */
import { execSync } from "node:child_process";
import path from "node:path";

import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

const API_BASE_URL = process.env.SMOKE_API_BASE_URL ?? "http://127.0.0.1:3001";
export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
export const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";
const OPERATOR_OWNER_MOBILE = "09174070937";
const DEV_OTP = "1234";

function operatorTenantHeaders(): Record<string, string> {
  return {
    host: "operator.localhost",
    "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
    "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
    "x-user-id": OPERATOR_OWNER_USER_ID,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-operator-smoke",
  };
}

export async function createOperatorNotificationApiContext(): Promise<APIRequestContext> {
  const bootstrap = await playwrightRequest.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: operatorTenantHeaders(),
  });

  const otpRes = await bootstrap.post("/auth/request-otp", {
    data: { mobile: OPERATOR_OWNER_MOBILE },
    timeout: 120_000,
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challengeId?: string; challenge_id?: string };
  const challengeId = otpBody.challengeId ?? otpBody.challenge_id;
  expect(typeof challengeId).toBe("string");

  const verifyRes = await bootstrap.post("/auth/verify-otp", {
    data: { challengeId, code: DEV_OTP },
    timeout: 120_000,
  });
  expect(verifyRes.ok(), await verifyRes.text()).toBeTruthy();
  const verifyBody = (await verifyRes.json()) as { sessionToken?: string };
  expect(typeof verifyBody.sessionToken).toBe("string");
  await bootstrap.dispose();

  return playwrightRequest.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: {
      ...operatorTenantHeaders(),
      Authorization: `Bearer ${verifyBody.sessionToken}`,
    },
  });
}

export async function operatorEnsureTourCapacity(
  operatorApi: APIRequestContext,
  tourId: string,
  capacityMax: number,
): Promise<void> {
  const getRes = await operatorApi.get(`/tours/${encodeURIComponent(tourId)}`, {
    timeout: 120_000,
  });
  expect(getRes.ok(), await getRes.text()).toBeTruthy();
  const tour = (await getRes.json()) as {
    rowVersion?: number;
    canonical?: { data?: Record<string, unknown> };
  };
  expect(typeof tour.rowVersion).toBe("number");
  const beforeData = tour.canonical?.data ?? {};
  const patchRes = await operatorApi.patch(`/tours/${encodeURIComponent(tourId)}`, {
    data: {
      rowVersion: tour.rowVersion,
      data: {
        capacityMax,
        basicInfo: {
          ...((beforeData.basicInfo as Record<string, unknown> | undefined) ?? {}),
          capacityMax,
        },
      },
      operatorMutationOverride: true,
    },
    timeout: 120_000,
  });
  expect(patchRes.ok(), await patchRes.text()).toBeTruthy();
}

export async function operatorCreatePendingBooking(
  operatorApi: APIRequestContext,
  input: { readonly guestLabel: string; readonly tourId?: string },
): Promise<string> {
  const res = await operatorApi.post("/bookings", {
    data: {
      tourId: input.tourId ?? OPERATOR_SMOKE_SEED_TOUR_ID,
      tourTitle: "North Ridge Trek",
      guestLabel: input.guestLabel,
      partySize: 1,
      departureAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      registrationIntake: { tourCapacityMax: 20 },
    },
    timeout: 120_000,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { id?: string; status?: string };
  expect(body.status).toBe("pending");
  expect(typeof body.id).toBe("string");
  return body.id!;
}

export async function operatorApproveBooking(
  operatorApi: APIRequestContext,
  bookingId: string,
): Promise<{ readonly paymentDueAt?: string }> {
  const res = await operatorApi.post(`/bookings/${encodeURIComponent(bookingId)}/approve`, {
    timeout: 120_000,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { status?: string; paymentDueAt?: string };
  expect(body.status).toBe("approved");
  return { paymentDueAt: body.paymentDueAt };
}

export async function operatorMarkAttendance(
  operatorApi: APIRequestContext,
  bookingId: string,
  attendanceStatus: "present" | "absent",
): Promise<{ readonly attendanceStatus: string; readonly idempotentReplay?: boolean }> {
  const res = await operatorApi.post(`/bookings/${encodeURIComponent(bookingId)}/attendance`, {
    data: { attendanceStatus },
    timeout: 120_000,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as {
    attendanceStatus?: string;
    idempotentReplay?: boolean;
  };
  expect(body.attendanceStatus).toBe(attendanceStatus);
  return {
    attendanceStatus: body.attendanceStatus!,
    idempotentReplay: body.idempotentReplay,
  };
}

export async function operatorUpdateTourSchedule(
  operatorApi: APIRequestContext,
  tourId: string,
): Promise<void> {
  const getRes = await operatorApi.get(`/tours/${encodeURIComponent(tourId)}`, {
    timeout: 120_000,
  });
  expect(getRes.ok(), await getRes.text()).toBeTruthy();
  const tour = (await getRes.json()) as {
    rowVersion?: number;
    canonical?: { data?: Record<string, unknown> };
  };
  expect(typeof tour.rowVersion).toBe("number");
  const beforeData = tour.canonical?.data ?? {};
  const nextStart = "2026-12-01T08:00:00.000Z";

  const patchRes = await operatorApi.patch(`/tours/${encodeURIComponent(tourId)}`, {
    data: {
      rowVersion: tour.rowVersion,
      data: {
        startDateTime: nextStart,
        basicInfo: {
          ...((beforeData.basicInfo as Record<string, unknown> | undefined) ?? {}),
          startDateTime: nextStart,
        },
      },
      operatorMutationOverride: true,
    },
    timeout: 120_000,
  });
  expect(patchRes.ok(), await patchRes.text()).toBeTruthy();
}

export function linkBookingToMember(input: {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly memberUserId: string;
}): void {
  const repoRoot = path.resolve(__dirname, "../../../../..");
  execSync("pnpm --filter @apps/api exec node --import tsx scripts/e2e-set-booking-submitter.ts", {
    cwd: repoRoot,
    env: {
      ...process.env,
      E2E_TENANT_ID: input.tenantId,
      E2E_BOOKING_ID: input.bookingId,
      E2E_MEMBER_USER_ID: input.memberUserId,
      STORAGE_DRIVER: "prisma",
    },
    stdio: "inherit",
  });
}
