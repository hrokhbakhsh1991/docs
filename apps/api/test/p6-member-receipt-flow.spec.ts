/**
 * P6-3 VS-05 — member receipt upload via bookings route (memory driver)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getBookingsRepository } from "../src/bookings/create-bookings-repository";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { installHttpTestClient } from "./http-test-client";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("p6-member-receipt-flow", () => {
  const client = installHttpTestClient(() => {
    const repo = createSharedMemoryTourStoreForHttpTests();
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

    const approved = await client.requestJson<{ id?: string }>(
      "POST",
      `/bookings/${registrationId}/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(approved.status, 200);
  });

  it("P6-MR-00 GET /bookings/{id}/receipts returns none before upload", async () => {
    const response = await client.requestJson<{ status?: string }>(
      "GET",
      `/bookings/${registrationId}/receipts`,
      {
        headers: memberHeaders(memberUserId, memberWorkspaceId),
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "none");
    assert.equal(typeof response.body.remainingMinor, "string");
    assert.ok(BigInt(String(response.body.remainingMinor ?? "0").replace(/\D/g, "") || "0") > 0n);
  });

  it("P6-MR-01 POST /bookings/{id}/receipts creates pending receipt for member owner", async () => {
    const response = await client.requestJson<Record<string, unknown>>(
      "POST",
      `/bookings/${registrationId}/receipts`,
      {
        headers: memberHeaders(memberUserId, memberWorkspaceId),
        body: { fileKey: `receipts/${OPERATOR_SMOKE.tenantId}/${registrationId}/proof.jpg` },
      }
    );
    assert.equal(response.status, 201);
    assert.equal(response.body.status, "Pending");
    assert.equal(
      response.body.fileKey,
      `receipts/${OPERATOR_SMOKE.tenantId}/${registrationId}/proof.jpg`
    );
  });

  it("P6-MR-01b GET /bookings/{id}/receipts returns pending after upload", async () => {
    const response = await client.requestJson<{
      status?: string;
      remainingMinor?: string | null;
      previewKind?: string | null;
      previewUrl?: string | null;
    }>("GET", `/bookings/${registrationId}/receipts`, {
      headers: memberHeaders(memberUserId, memberWorkspaceId),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "pending");
    assert.equal(response.body.previewKind, "image");
    assert.ok(BigInt(String(response.body.remainingMinor ?? "0").replace(/\D/g, "") || "0") > 0n);
  });

  it("P6-MR-01d accepts a binary receipt with a Persian note in the ASCII-safe header", async () => {
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559001127",
      displayName: "P6 Binary Receipt Member",
      email: "p6-binary-receipt-member@denali-smoke.local",
    });
    const workspaceId = membership.workspaceId ?? "ws-public-binary-receipt";
    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: memberHeaders(user.id, workspaceId),
        body: {
          tourId: OPERATOR_SMOKE.seedTourId,
          contact: {
            email: "p6-binary-receipt-member@denali-smoke.local",
            fullName: "P6 Binary Receipt Member",
          },
          partySize: 1,
        },
      }
    );
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);

    const approved = await client.requestJson<{ id?: string }>(
      "POST",
      `/bookings/${bookingId}/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(approved.status, 200);

    const note = "QA TEST ONLY — توضیح رسید ساختگی؛ پرداخت واقعی انجام نشده.";
    const upload = await client.requestRaw("POST", `/bookings/${bookingId}/receipts`, {
      headers: {
        ...memberHeaders(user.id, workspaceId),
        "content-type": "image/png",
        "x-receipt-file-name": "qa-synthetic.png",
        "x-receipt-note-base64url": Buffer.from(note, "utf8").toString("base64url"),
      },
      rawBody: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    assert.equal(upload.status, 201, upload.body.toString("utf8"));
    const receipt = JSON.parse(upload.body.toString("utf8")) as {
      status?: string;
      note?: string;
      fileKey?: string;
    };
    assert.equal(receipt.status, "Pending");
    assert.equal(receipt.note, note);
    assert.match(receipt.fileKey ?? "", /\/qa-synthetic\.png-[a-f0-9]+$/);
  });

  it("P6-MR-01c pending booking cannot upload receipt (approve-then-pay)", async () => {
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559001126",
      displayName: "P6 Receipt Pending Gate",
      email: "p6-receipt-pending-gate@denali-smoke.local",
    });
    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-pending-gate"),
        body: {
          tourId: OPERATOR_SMOKE.seedTourId,
          contact: {
            email: "p6-receipt-pending-gate@denali-smoke.local",
            fullName: "P6 Receipt Pending Gate",
          },
          partySize: 1,
        },
      }
    );
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);

    const response = await client.requestJson<{ code?: string }>(
      "POST",
      `/bookings/${bookingId}/receipts`,
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-pending-gate"),
        body: { fileKey: `receipts/${bookingId}/too-early.jpg` },
      }
    );
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "FINANCE_RECEIPT_REQUIRES_APPROVED_BOOKING");
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

  it("P6-MR-02b foreign member cannot read receipt status for another registration", async () => {
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559001125",
      displayName: "P6 Receipt Status Stranger",
    });
    const response = await client.requestJson<{ code?: string }>(
      "GET",
      `/bookings/${registrationId}/receipts`,
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-status-stranger"),
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "BOOKINGS_FORBIDDEN");
  });

  it("BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE / P6-MR-03 operator approval updates booking and member list projection", async () => {
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
          contact: {
            email: "p6-receipt-approve@denali-smoke.local",
            fullName: "P6 Receipt Approve",
          },
          partySize: 1,
        },
      }
    );
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";

    const approved = await client.requestJson<{ id?: string }>(
      "POST",
      `/bookings/${bookingId}/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(approved.status, 200);

    const upload = await client.requestJson<{ id?: string }>(
      "POST",
      `/bookings/${bookingId}/receipts`,
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-approve"),
        body: { fileKey: `receipts/${OPERATOR_SMOKE.tenantId}/${bookingId}/approve-proof.jpg` },
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
          "Idempotency-Key": `p6-mr-approve-${receiptId}`,
        },
        body: { decision: "approve" },
      }
    );
    assert.equal(review.status, 200);
    assert.equal(review.body.status, "Approved");
    assert.ok(typeof review.body.ledgerJournalId === "string");
    assert.equal((review.body as { bookingPaymentStatus?: string }).bookingPaymentStatus, "paid");

    const booking = await getBookingsRepository().getById(bookingId, OPERATOR_SMOKE.tenantId);
    assert.equal(booking?.paymentStatus, "paid");

    const list = await client.requestJson<{
      items?: readonly { id?: string; paymentStatus?: string }[];
    }>("GET", "/bookings?view=mine&limit=50", {
      headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-approve"),
    });
    assert.equal(list.status, 200);
    const listed = list.body.items?.find((item) => item.id === bookingId);
    assert.equal(listed?.paymentStatus, "paid");

    const status = await client.requestJson<{ status?: string }>(
      "GET",
      `/bookings/${bookingId}/receipts`,
      {
        headers: memberHeaders(user.id, membership.workspaceId ?? "ws-public-approve"),
      }
    );
    assert.equal(status.status, 200);
    assert.equal(status.body.status, "paid");
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
