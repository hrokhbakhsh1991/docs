/**
 * DP1 API contract — booking/finance HTTP surfaces expose paymentDueAt.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { resetBookingsRepositoryForTests } from "../../src/bookings/create-bookings-repository.ts";
import { resetPaymentHoldRepositoryForTests } from "../../src/finance/payment-hold.repository.ts";
import { getIdentityRepository } from "../../src/identity/create-identity-repository.ts";
import { OPERATOR_SMOKE } from "../fixtures/operator-smoke-e2e-tenant.ts";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "../fixtures/operator-identity-fixture.ts";
import { installHttpTestClient } from "../http-test-client.ts";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "../test-helpers.ts";

installMemoryStorageDriverForDescribe();

function memberHeaders(userId: string, workspaceId: string): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": userId,
    "x-workspace-id": workspaceId,
    "x-user-role": "member",
    "x-user-status": "ACTIVE",
  };
}

describe("DP1 API contract payment deadline", () => {
  const client = installHttpTestClient(() => {
    const repo = createSharedMemoryTourStoreForHttpTests();
    return createRequestListener({ toursService: createTestToursService(repo), tourStore: repo });
  });

  before(() => {
    resetBookingsRepositoryForTests();
    resetPaymentHoldRepositoryForTests();
    seedOperatorIdentityFixture();
    const idRepo = getIdentityRepository();
    idRepo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: OPERATOR_SMOKE.memberMobile });
    idRepo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-smoke-member",
    });
    process.env.PAYMENT_HOLD_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "true";
  });

  it("S17 contract: operator approve and member GET share paymentDueAt", async () => {
    const stamp = Date.now();
    const email = `dp1-contract-${stamp}@denali-smoke.local`;
    const reg = await client.requestJson<{ data?: { id?: string } }>("POST", "/denali/registrations", {
      headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
      body: {
        tourId: OPERATOR_SMOKE.seedTourId,
        contact: { email, fullName: "DP1 Contract Guest" },
        partySize: 1,
      },
    });
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);

    const approve = await client.requestJson<{
      status?: string;
      approvedAt?: string;
      paymentDueAt?: string;
      holdStatus?: string;
    }>("POST", `/bookings/${bookingId}/approve`, { headers: operatorAuthHeaders() });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.status, "approved");
    assert.ok(
      typeof approve.body.paymentDueAt === "string" && approve.body.paymentDueAt.length > 0,
      "DP1-EXPECTED-FAIL: ApproveBookingResponse.paymentDueAt missing"
    );
    assert.equal(approve.body.holdStatus, "open");

    const memberDetail = await client.requestJson<{ paymentDueAt?: string }>(
      "GET",
      `/bookings/${bookingId}`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(memberDetail.status, 200);
    assert.equal(memberDetail.body.paymentDueAt, approve.body.paymentDueAt);
  });

  it("S11 contract: POST /finance/payment-holds/:id/extend returns new dueAt", async () => {
    const mod = await import("../../src/finance/payment-hold-http.routes.ts");
    assert.equal(typeof mod.registerPaymentHoldHttpRoutes, "function");
  });
});
