/**
 * P6 Bundle B — one booking chains VS-03→06→05→07 (in-memory API)
 * @see docs/phase-19/p6/appendices/SMOKE-SCENARIO-MAP-P6.md SMK-P6-VS-CHAIN
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import ExcelJS from "exceljs";

import { createRequestListener } from "../src/app";
import { getBookingsRepository } from "../src/bookings/create-bookings-repository";
import { peekOutboxByAggregateForTests } from "../src/bookings/in-memory-bookings.repository";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("p6-vertical-slice-chain", () => {
  const client = installHttpTestClient(() => {
    const repo = createSharedMemoryTourStoreForHttpTests();
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

    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: member,
        body: {
          tourId: OPERATOR_SMOKE.seedTourId,
          contact: { email, fullName: "P6 Chain Guest" },
          partySize: 2,
        },
      }
    );
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
    const outboxRows = await peekOutboxByAggregateForTests({
      tenantId: OPERATOR_SMOKE.tenantId,
      aggregateId: bookingId,
    });
    assert.ok(outboxRows.length >= 2);
    assert.ok(outboxRows.some((row) => row.eventType === "registration.created"));
    assert.ok(outboxRows.some((row) => row.eventType === "registration.approved"));

    const fileKey = `receipts/${OPERATOR_SMOKE.tenantId}/${bookingId}/chain-proof.jpg`;
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

    const receiptReviewKey = `p6-vs-approve-${receiptId}`;
    const review = await client.requestJson<{ status?: string; ledgerJournalId?: string }>(
      "PATCH",
      `/finance/receipts/${receiptId}/review`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "content-type": "application/json",
          "Idempotency-Key": receiptReviewKey,
        },
        body: { decision: "approve" },
      }
    );
    assert.equal(review.status, 200);
    assert.equal(review.body.status, "Approved");
    assert.ok(typeof review.body.ledgerJournalId === "string");

    const reviewReplay = await client.requestJson<{
      status?: string;
      ledgerJournalId?: string;
    }>("PATCH", `/finance/receipts/${receiptId}/review`, {
      headers: {
        ...operatorAuthHeaders(),
        "content-type": "application/json",
        "Idempotency-Key": receiptReviewKey,
      },
      body: { decision: "approve" },
    });
    assert.equal(reviewReplay.status, 200);
    assert.equal(reviewReplay.body.status, "Approved");
    assert.equal(reviewReplay.body.ledgerJournalId, review.body.ledgerJournalId);

    const mine = await client.requestJson<{ items?: Array<{ id: string; status: string }> }>(
      "GET",
      "/bookings?view=mine&limit=50",
      { headers: member }
    );
    assert.equal(mine.status, 200);
    const row = mine.body.items?.find((item) => item.id === bookingId);
    assert.ok(row !== undefined);
    assert.equal(row?.status, "approved");

    const finalized = await client.requestJson<{ finalizationStatus?: string }>(
      "POST",
      `/bookings/${bookingId}/finalize`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(finalized.status, 200);

    const roster = await client.requestJson<{
      items?: Array<{
        registrationId?: string;
        guestLabel?: string;
        partySize?: number;
        finalizationStatus?: string;
        financialDisplayState?: string;
        isFinalParticipant?: boolean;
      }>;
    }>(
      "GET",
      `/tours/${encodeURIComponent(OPERATOR_SMOKE.seedTourId)}/operational-roster?filter=final&view=ops`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(roster.status, 200);
    const rosterRow = roster.body.items?.find((item) => item.registrationId === bookingId);
    assert.ok(rosterRow, "finalized booking missing from operational roster");
    assert.equal(rosterRow?.guestLabel, "P6 Chain Guest");
    assert.equal(rosterRow?.partySize, 2);
    assert.equal(rosterRow?.finalizationStatus, "finalized");
    assert.equal(rosterRow?.financialDisplayState, "PAID");
    assert.equal(rosterRow?.isFinalParticipant, true);

    const exportResponse = await client.requestRaw(
      "GET",
      `/tours/${encodeURIComponent(OPERATOR_SMOKE.seedTourId)}/operational-roster/export?filter=final&format=xlsx`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(exportResponse.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);
    const finalSheet = workbook.getWorksheet("لیست نهایی");
    assert.ok(finalSheet, "XLSX final roster worksheet missing");
    const exportRow = finalSheet
      .getRows(2, Math.max(0, finalSheet.rowCount - 1))
      ?.find((item) => item.getCell(2).value === "P6 Chain Guest");
    assert.ok(exportRow, "the same finalized booking is missing from XLSX");
    assert.equal(exportRow?.getCell(4).value, 2);
    assert.equal(exportRow?.getCell(5).value, "نهایی‌شده");
    assert.equal(exportRow?.getCell(6).value, "پرداخت کامل");
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
