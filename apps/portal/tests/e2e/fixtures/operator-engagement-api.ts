/**
 * FDA-001 — operator engagement API helpers for cross-surface portal smoke tests.
 * Uses API directly (portal smoke stack does not start @apps/web).
 */
import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

const API_BASE_URL = process.env.SMOKE_API_BASE_URL ?? "http://127.0.0.1:3001";
const OPERATOR_HOST = "operator.localhost";
const OPERATOR_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";
const OPERATOR_OWNER_MOBILE = "09174070937";
const DEV_OTP = "1234";

function operatorTenantHeaders(): Record<string, string> {
  return {
    host: OPERATOR_HOST,
    "x-tenant-id": OPERATOR_TENANT_ID,
    "x-authenticated-tenant-id": OPERATOR_TENANT_ID,
    "x-user-id": OPERATOR_OWNER_USER_ID,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-operator-smoke",
  };
}

export async function createOperatorEngagementApiContext(): Promise<APIRequestContext> {
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
    data: {
      challengeId,
      code: DEV_OTP,
    },
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

export async function operatorAdjustMemberPoints(
  operatorApi: APIRequestContext,
  userId: string,
  input: { readonly pointsDelta: number; readonly reason: string; readonly idempotencyKey: string },
): Promise<void> {
  const res = await operatorApi.post(
    `/engagement/operator/members/${encodeURIComponent(userId)}/adjust`,
    {
      data: {
        pointsDelta: input.pointsDelta,
        reason: input.reason,
      },
      headers: { "Idempotency-Key": input.idempotencyKey },
      timeout: 120_000,
    },
  );
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function operatorReverseMemberPointEvent(
  operatorApi: APIRequestContext,
  userId: string,
  input: {
    readonly originalEventId: string;
    readonly reason: string;
    readonly idempotencyKey: string;
  },
): Promise<void> {
  const res = await operatorApi.post(
    `/engagement/operator/members/${encodeURIComponent(userId)}/reverse`,
    {
      data: {
        originalEventId: input.originalEventId,
        reason: input.reason,
      },
      headers: { "Idempotency-Key": input.idempotencyKey },
      timeout: 120_000,
    },
  );
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function operatorFetchMemberEngagement(
  operatorApi: APIRequestContext,
  userId: string,
): Promise<{
  readonly totalPoints: number;
  readonly recentPointEvents: readonly {
    readonly id: string;
    readonly pointsDelta: number;
    readonly sourceEventType: string;
    readonly reason: string | null;
    readonly actorRole: string | null;
  }[];
}> {
  const res = await operatorApi.get(
    `/engagement/operator/members/${encodeURIComponent(userId)}`,
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as {
    summary?: {
      totalPoints?: number;
      recentPointEvents?: readonly {
        id: string;
        pointsDelta: number;
        sourceEventType: string;
        reason: string | null;
        actorRole: string | null;
      }[];
    };
  };
  return {
    totalPoints: body.summary?.totalPoints ?? 0,
    recentPointEvents: body.summary?.recentPointEvents ?? [],
  };
}
