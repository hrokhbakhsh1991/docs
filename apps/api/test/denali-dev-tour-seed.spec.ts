/**
 * FE-14 / TR-09 — Denali dev memory tour seed on operator GET (not only list).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { parseTenantAuthContext } from "@app-tour/workspace-sdk";

import { DENALI_CLUB_DEV_DRAFT_TOUR_ID, DENALI_CLUB_DEV_PUBLISHED_TOUR_ID } from "../src/fixtures/operator-smoke-published-tour.fixture";
import { ensureDevMemoryTourSeedForTenant } from "../src/storage/create-tour-storage";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("denali-dev-tour-seed.spec.ts — FE-14/TR-09", () => {
  it("ensureDevMemoryTourSeedForTenant indexes smoke tour on injected store", async () => {
    const store = new InMemoryTourRepository();
    ensureDevMemoryTourSeedForTenant(DENALI_SMOKE_TENANT_ID, store);
    const hit = await store.getById(DENALI_CLUB_DEV_PUBLISHED_TOUR_ID, DENALI_SMOKE_TENANT_ID);
    assert.ok(hit);
    assert.equal(hit.tenantId, DENALI_SMOKE_TENANT_ID);
  });

  it("ED-SEED-01 memory seed indexes published + draft (≥2 editable)", async () => {
    const store = new InMemoryTourRepository();
    ensureDevMemoryTourSeedForTenant(DENALI_SMOKE_TENANT_ID, store);
    const published = await store.getById(DENALI_CLUB_DEV_PUBLISHED_TOUR_ID, DENALI_SMOKE_TENANT_ID);
    const draft = await store.getById(DENALI_CLUB_DEV_DRAFT_TOUR_ID, DENALI_SMOKE_TENANT_ID);
    assert.ok(published);
    assert.ok(draft);
    assert.equal((draft.canonical.data as { publishStatus?: string }).publishStatus, "draft");
    const program = published.canonical.data.program as {
      itinerary?: Array<{ title?: string }>;
    };
    assert.equal(program.itinerary?.length, 3);
    assert.ok(program.itinerary?.every((day) => (day.title ?? "").trim().length > 0));
  });

  it("API-9.3-03b getTourById seeds denali smoke tour on active memory store", async () => {
    const service = createTestToursService();
    const auth = parseTenantAuthContext({
      userId: OPERATOR_SMOKE.ownerUserId,
      tenantId: DENALI_SMOKE_TENANT_ID,
      role: "owner",
      status: "ACTIVE",
    });

    const record = await service.getTourById(auth, DENALI_CLUB_DEV_PUBLISHED_TOUR_ID);
    assert.ok(record);
    assert.equal(record.id, DENALI_CLUB_DEV_PUBLISHED_TOUR_ID);
    assert.equal(record.tenantId, DENALI_SMOKE_TENANT_ID);
  });
});
