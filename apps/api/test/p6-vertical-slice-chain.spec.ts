/**
 * P6 Bundle B — one booking chains VS-03→06→05→07 (in-memory API)
 * @see docs/phase-19/p6/appendices/SMOKE-SCENARIO-MAP-P6.md SMK-P6-VS-CHAIN
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getBookingsRepository } from "../src/bookings/create-bookings-repository";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("p6-vertical-slice-chain", () => {
  const client = installHttpTestClient(() => {
    const repo = new InMemoryTourRepository();
    repo.ensureOperatorSmokeSeedTour();
    return createRequestListener({ toursService: createTestToursService(repo), tourStore: repo });
  });

  before(() => {
    seedOperatorIdentityFixture();
  });

  it("P6-VS-CHAIN-01 guest register → approve booking → member receipt → approve receipt (same id)", async () => {
    const idRepo = getIdentityRepository();
    const stamp = Date.now();
    const email = `p6-chain-${stamp}@denali-smoke.local`;
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: `+1555${String(stamp).slice(-7)}`,
      displayName: "P6 Chain Guest",
      email,
    });
    const workspaceId = membership.workspaceId ?? "ws-p6-chain";
    const member = memberHeaders(user.id, workspaceId);

    const reg = await client.requestJson<{ data?: { id?: string } }>("POST", "/denali/registrations", {
      headers: member,
      body: {
        tourId: OPERATOR_SMOKE.seedTourId,
        contact: { email, fullName: "P6 Chain Guest" },
        partySize: 2,
      },
    });
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);

    const approve = await client.requestJson<{ status?: string }>(
      "POST",
      `/bookings/${bookingId}/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(approve.status, 200);
    assert.equal(approve.body.status, "approved");

    const bookingsRepo = getBookingsRepository();
    const outboxRows = await bookingsRepo.listOutboxByAggregate(bookingId);
    assert.equal(outboxRows.length, 1);
    assert.equal(outboxRows[0]?.eventType, "registration.approved");

    const fileKey = `receipts/${bookingId}/chain-proof.jpg`;
    const upload = await client.requestJson<{ id?: string; status?: string }>(
      "POST",
      `/bookings/${bookingId}/receipts`,
      {
        headers: member,
        body: { fileKey },
      }
    );
    assert.equal(upload.status, 201);
    assert.equal(upload.body.status, "Pending");
    const receiptId = upload.body.id ?? "";
    assert.ok(receiptId.length > 0);

    const review = await client.requestJson<{ status?: string; ledgerJournalId?: string }>(
      "PATCH",
      `/finance/receipts/${receiptId}/review`,
      {
        headers: { ...operatorAuthHeaders(), "content-type": "application/json" },
        body: { decision: "approve" },
      }
    );
    assert.equal(review.status, 200);
    assert.equal(review.body.status, "Approved");
    assert.ok(typeof review.body.ledgerJournalId === "string");

    const mine = await client.requestJson<{ items?: Array<{ id: string; status: string }> }>(
      "GET",
      "/bookings?view=mine&limit=50",
      { headers: member }
    );
    assert.equal(mine.status, 200);
    const row = mine.body.items?.find((item) => item.id === bookingId);
    assert.ok(row !== undefined);
    assert.equal(row?.status, "approved");
  });
});

function memberHeaders(userId: string, workspaceId: string): Record<string, string> {
  return {
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": userId,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": workspaceId,
    "content-type": "application/json",
  };
}
