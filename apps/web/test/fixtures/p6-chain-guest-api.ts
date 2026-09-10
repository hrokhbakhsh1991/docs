/**
 * P6 Bundle B/C — guest registration via public denali API (for browser chain E2E)
 * Uses anonymous catalog actor (x-tenant-id only) — same as DREG-16-01.
 * @see docs/phase-19/p6/appendices/SMOKE-SCENARIO-MAP-P6.md SMK-P6-VS-CHAIN
 */
import { expect, type APIRequestContext } from "@playwright/test";

/** Postgres / operator smoke host (`admin.operator.localhost`, staging). */
export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
export const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
// Isolate the chain from the general operator smoke tour; the latter is intentionally reused by
// other flows and can legitimately reach capacity during a full browser suite.
export const OPERATOR_SMOKE_CHAIN_TOUR_ID = "00000000-0000-4000-8000-000000000213";
const PUBLIC_CATALOG_GUEST_USER_ID = "00000000-0000-4000-0000-000000000001";

export type ChainGuestRegistration = {
  readonly bookingId: string;
  readonly guestName: string;
  readonly memberUserId: string;
  readonly memberWorkspaceId: string;
};

export function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

function resolvePlaywrightBaseUrl(): string {
  return (
    process.env.PLAYWRIGHT_BASE_URL?.trim() ??
    process.env.SMOKE_DENALI_WEB_BASE_URL?.trim() ??
    "http://admin.operator.localhost:3000"
  );
}

function resolvePlaywrightPort(base: string): number | null {
  try {
    const url = new URL(base);
    if (url.port.length > 0) {
      return Number(url.port);
    }
    return url.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

/**
 * True when smoke catalog should use denali-dev tenant 003 + tour 220.
 * Covers memory-driver `admin.denali.localhost` and Profile B-staging (230xx / bare IP).
 */
export function usesDenaliDevMemoryFixtures(): boolean {
  const base = resolvePlaywrightBaseUrl();
  if (/admin\.denali\.localhost/i.test(base)) {
    return true;
  }
  const port = resolvePlaywrightPort(base);
  // Profile B-staging isolated stack — operator admin host maps to denali-dev workspace.
  if (port !== null && port >= 23_000 && port <= 23_099) {
    return true;
  }
  try {
    const hostname = new URL(base).hostname;
    // Bare-IP Profile B with external servers — OTP session binds tenant 003 (not tour …0210).
    if (/^(\d{1,3}\.){3}\d+$/.test(hostname) && process.env.PW_EXTERNAL_SERVERS === "1") {
      return true;
    }
  } catch {
    // ignore invalid base URL
  }
  return false;
}

export function resolveChainSmokeTenantId(): string {
  const override = process.env.QA_TENANT_ID?.trim();
  if (override) {
    return override;
  }
  return usesDenaliDevMemoryFixtures()
    ? DENALI_DEV_SMOKE_TENANT_ID
    : OPERATOR_SMOKE_TENANT_ID;
}

export function resolveChainSmokePublishedTourId(): string {
  const override = process.env.QA_TOUR_ID?.trim();
  if (override) {
    return override;
  }
  return usesDenaliDevMemoryFixtures()
    ? DENALI_DEV_SMOKE_PUBLISHED_TOUR_ID
    : OPERATOR_SMOKE_PUBLISHED_TOUR_ID;
}

function guestReceiptHeaders(userId: string, workspaceId: string): Record<string, string> {
  const tenantId = resolveChainSmokeTenantId();
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": workspaceId,
    "content-type": "application/json",
  };
}

export async function seedChainGuestRegistrationViaApi(
  request: APIRequestContext,
  input: {
    readonly guestName: string;
    readonly email: string;
    readonly mobile?: string;
    readonly tenantId?: string;
    readonly tourId?: string;
  }
): Promise<ChainGuestRegistration> {
  const tenantId = input.tenantId ?? OPERATOR_SMOKE_TENANT_ID;
  const tourId = input.tourId ?? OPERATOR_SMOKE_CHAIN_TOUR_ID;
  const regRes = await request.post(`${tourOpsApiBase()}/denali/registrations`, {
    headers: {
      "x-tenant-id": tenantId,
      "content-type": "application/json",
    },
    data: {
      tourId,
      // Use an explicit other-guest identity so reruns are unique by the generated phone/name;
      // the anonymous catalog actor is intentionally stable and must not be the dedupe key.
      registrantTarget: "other",
      contact: {
        email: input.email,
        fullName: input.guestName,
        ...(input.mobile === undefined ? {} : { phone: input.mobile }),
      },
      partySize: 2,
    },
  });
  expect(regRes.status(), await regRes.text()).toBe(201);
  const regBody = (await regRes.json()) as { data?: { id?: string } };
  const bookingId = regBody.data?.id ?? "";
  expect(bookingId.length).toBeGreaterThan(0);

  return {
    bookingId,
    guestName: input.guestName,
    memberUserId: PUBLIC_CATALOG_GUEST_USER_ID,
    memberWorkspaceId: "ws-public-catalog-guest",
  };
}

export async function seedMemberReceiptViaApi(
  request: APIRequestContext,
  input: {
    readonly bookingId: string;
    readonly memberUserId: string;
    readonly memberWorkspaceId: string;
    readonly fileKey: string;
  }
): Promise<void> {
  const res = await request.post(
    `${tourOpsApiBase()}/bookings/${encodeURIComponent(input.bookingId)}/receipts`,
    {
      headers: guestReceiptHeaders(input.memberUserId, input.memberWorkspaceId),
      data: { fileKey: input.fileKey },
    }
  );
  expect(res.status(), await res.text()).toBe(201);
}
