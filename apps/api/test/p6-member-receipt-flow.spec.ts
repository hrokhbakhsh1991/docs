/**
 * P6-3 VS-05 — member receipt upload via bookings route (memory driver)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { installHttpTestClient } from "./http-test-client";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { operatorAuthHeaders, seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";

installMemoryStorageDriverForDescribe();

describe("p6-member-receipt-flow", () => {
  const client = installHttpTestClient(() => {
    const repo = new InMemoryTourRepository();
    repo.ensureOperatorSmokeSeedTour();
    return createRequestListener({ toursService: createTestToursService(repo), tourStore: repo });
  });

  let memberUserId = "";
  let memberWorkspaceId = "";
  let registrationId = "";

  before(async () => {
    seedOperatorIdentityFixture();
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559001122",
      displayName: "P6 Receipt Member",
      email: "p6-receipt-member@denali-smoke.local",
    });
    memberUserId = user.id;
    memberWorkspaceId = membership.workspaceId ?? "ws-public-p6";

    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: memberHeaders(memberUserId, memberWorkspaceId),
        body: {
          tourId: OPERATOR_SMOKE.seedTourId,
          contact: { email: "p6-receipt-member@denali-smoke.local", fullName: "P6 Receipt Member" },
          partySize: 2,
        },
      }
    );
    assert.equal(reg.status, 201);
    registrationId = reg.body.data?.id ?? "";
    assert.ok(registrationId.length > 0);
  });

  it("P6-MR-01 POST /bookings/{id}/receipts creates pending receipt for member owner", async () => {
    const response = await client.requestJson<Record<string, unknown>>(
      "POST",
      `/bookings/${registrationId}/receipts`,
      {
        headers: memberHeaders(memberUserId, memberWorkspaceId),
        body: { fileKey: `receipts/${registrationId}/proof.jpg` },
      }
    );
    assert.equal(response.status, 201);
    assert.equal(response.body.status, "Pending");
    assert.equal(response.body.fileKey, `receipts/${registrationId}/proof.jpg`);
  });

  it("P6-MR-02 foreign member cannot upload receipt for another registration", async () => {
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559001123",
      displayName: "P6 Receipt Stranger",
    });
    const response = await client.requestJson<{ code?: string }>(
      "POST",
      `/bookings/${registrationId}/receipts`,
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-stranger"),
        body: { fileKey: `receipts/${registrationId}/stolen.jpg` },
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "BOOKINGS_FORBIDDEN");
  });

  it("P6-MR-03 operator approves member receipt (VS-07 memory path)", async () => {
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559001124",
      displayName: "P6 Receipt Approve",
      email: "p6-receipt-approve@denali-smoke.local",
    });
    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-approve"),
        body: {
          tourId: OPERATOR_SMOKE.seedTourId,
          contact: { email: "p6-receipt-approve@denali-smoke.local", fullName: "P6 Receipt Approve" },
          partySize: 1,
        },
      }
    );
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";

    const upload = await client.requestJson<{ id?: string }>(
      "POST",
      `/bookings/${bookingId}/receipts`,
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-approve"),
        body: { fileKey: `receipts/${bookingId}/approve-proof.jpg` },
      }
    );
    assert.equal(upload.status, 201);
    const receiptId = upload.body.id ?? "";
    assert.ok(receiptId.length > 0);

    const review = await client.requestJson<{ status?: string; ledgerJournalId?: string }>(
      "PATCH",
      `/finance/receipts/${receiptId}/review`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "content-type": "application/json",
        },
        body: { decision: "approve" },
      }
    );
    assert.equal(review.status, 200);
    assert.equal(review.body.status, "Approved");
    assert.ok(typeof review.body.ledgerJournalId === "string");
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
