/**
 * DP-2 API contract — GET /tours/:tourId/operational-roster
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { resetBookingsRepositoryForTests } from "../../src/bookings/create-bookings-repository.ts";
import { resetPaymentHoldRepositoryForTests } from "../../src/finance/payment-hold.repository.ts";
import { operatorAuthHeaders } from "../fixtures/operator-identity-fixture.ts";
import { installHttpTestClient } from "../http-test-client.ts";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "../test-helpers.ts";
import {
  DP1_TOUR_ID,
  dp1CreateAndApprovePending,
  resetDp1MemoryHarness,
} from "../dp1/dp1-test-harness.ts";

installMemoryStorageDriverForDescribe();

describe("DP-2 operational roster API contract", () => {
  const client = installHttpTestClient(() => {
    const repo = createSharedMemoryTourStoreForHttpTests();
    return createRequestListener({ toursService: createTestToursService(repo), tourStore: repo });
  });

  before(() => {
    resetDp1MemoryHarness();
    resetBookingsRepositoryForTests();
    resetPaymentHoldRepositoryForTests();
    process.env.PAYMENT_HOLD_ENABLED = "true";
  });

  it("returns composed roster rows with DP-2 fields", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();

    const response = await client.requestJson<{
      tourId?: string;
      filter?: string;
      items?: Array<{
        registrationId?: string;
        financialDisplayState?: string;
        isFinalParticipant?: boolean;
        paymentDueAt?: string;
        passengerAssignmentStatus?: string;
      }>;
    }>("GET", `/tours/${DP1_TOUR_ID}/operational-roster?filter=operational&view=ops`, {
      headers: operatorAuthHeaders(),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.tourId, DP1_TOUR_ID);
    assert.equal(response.body.filter, "operational");
    const row = response.body.items?.find((item) => item.registrationId === bookingId);
    assert.ok(row, "roster row missing for approved booking");
    assert.equal(row.financialDisplayState, "UNPAID");
    assert.equal(row.isFinalParticipant, false);
    assert.equal(row.passengerAssignmentStatus, "not_implemented");
    assert.ok(typeof row.paymentDueAt === "string" && row.paymentDueAt.length > 0);
  });

  it("supports filter query tokens", async () => {
    const filters = ["final", "unpaid", "paid", "expiring", "waitlist"] as const;
    for (const filter of filters) {
      const response = await client.requestJson(
        "GET",
        `/tours/${DP1_TOUR_ID}/operational-roster?filter=${filter}`,
        {
          headers: operatorAuthHeaders(),
        }
      );
      assert.equal(response.status, 200, `filter=${filter} must return 200`);
    }
  });

  it("accepts only the final XLSX export contract", async () => {
    const response = await client.requestJson<{ code?: string }>(
      "GET",
      `/tours/${DP1_TOUR_ID}/operational-roster/export?filter=final&format=csv`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "TOUR_ROSTER_EXPORT_FORMAT_INVALID");
  });

  it("returns an XLSX attachment for an authorized tour export", async () => {
    await dp1CreateAndApprovePending();
    const response = await client.requestRaw(
      "GET",
      `/tours/${DP1_TOUR_ID}/operational-roster/export?filter=final&format=xlsx`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 200);
    assert.equal(
      response.headers["content-type"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    assert.match(
      String(response.headers["content-disposition"]),
      /denali-final-roster-.*\.xlsx/
    );
    assert.equal(response.body.subarray(0, 2).toString("hex"), "504b");
  });

  it("returns not found for an authorized export of an unknown tour", async () => {
    const response = await client.requestJson<{ code?: string }>(
      "GET",
      "/tours/tour-does-not-exist/operational-roster/export?filter=final&format=xlsx",
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "TOUR_NOT_FOUND");
  });

  it("requires operator authentication for roster export", async () => {
    const response = await client.requestJson(
      "GET",
      `/tours/${DP1_TOUR_ID}/operational-roster/export?filter=final&format=xlsx`
    );
    assert.equal(response.status, 401);
  });
});
