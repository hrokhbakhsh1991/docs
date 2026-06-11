/**
 * Phase 9.5 — manual booking create
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getBookingsRepository } from "../src/bookings/create-bookings-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorBookingsFixture } from "./fixtures/operator-bookings-fixture";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type CreateBookingResponse = {
  readonly id?: string;
  readonly status?: string;
};

function createBookingsCreateListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("bookings-create.spec.ts — Phase 9.5 API", () => {
  const client = installHttpTestClient(createBookingsCreateListener);

  before(() => {
    seedOperatorIdentityFixture();
    seedOperatorBookingsFixture();
  });

  it("API-9.5-04 POST /bookings manual create returns 201 pending", async () => {
    const departureAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const response = await client.requestJson<CreateBookingResponse>("POST", "/bookings", {
      headers: operatorAuthHeaders(),
      body: {
        tourId: OPERATOR_SMOKE.seedTourId,
        tourTitle: "Manual Create Tour",
        guestLabel: "New Guest",
        partySize: 2,
        departureAt,
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.status, "pending");
    assert.equal(typeof response.body.id, "string");

    const repo = getBookingsRepository();
    const created = await repo.getById(response.body.id ?? "");
    assert.ok(created !== null);
    assert.equal(created?.status, "pending");
    assert.equal(created?.guestLabel, "New Guest");
  });
});
