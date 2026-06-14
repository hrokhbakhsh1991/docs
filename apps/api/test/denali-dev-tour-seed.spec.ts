/**
 * FE-14 / TR-09 — Denali dev memory tour seed on operator GET (not only list).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { parseTenantAuthContext } from "@app-tour/workspace-sdk";

import { ensureDevMemoryTourSeedForTenant } from "../src/storage/create-tour-storage";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("denali-dev-tour-seed.spec.ts — FE-14/TR-09", () => {
  it("ensureDevMemoryTourSeedForTenant indexes smoke tour on injected store", async () => {
    const store = new InMemoryTourRepository();
    ensureDevMemoryTourSeedForTenant(DENALI_SMOKE_TENANT_ID, store);
    const hit = await store.getById(OPERATOR_SMOKE.seedTourId, DENALI_SMOKE_TENANT_ID);
    assert.ok(hit);
    assert.equal(hit.tenantId, DENALI_SMOKE_TENANT_ID);
  });

  it("API-9.3-03b getTourById seeds denali smoke tour on active memory store", async () => {
    const service = createTestToursService();
    const auth = parseTenantAuthContext({
      userId: OPERATOR_SMOKE.ownerUserId,
      tenantId: DENALI_SMOKE_TENANT_ID,
      role: "owner",
      status: "ACTIVE",
    });

    const record = await service.getTourById(auth, OPERATOR_SMOKE.seedTourId);
    assert.ok(record);
    assert.equal(record.id, OPERATOR_SMOKE.seedTourId);
    assert.equal(record.tenantId, DENALI_SMOKE_TENANT_ID);
  });
});
