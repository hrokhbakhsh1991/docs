/**
 * Booking outbox tenant boundaries — external lookups require tenantId + aggregateId.
 * Cross-tenant aggregate id must not resolve outbox rows.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import {
  resetBookingsRepositoryForTests,
} from "./create-bookings-repository.ts";
import { peekOutboxByAggregateForTests } from "./in-memory-bookings.repository.ts";
import {
  approveBooking,
  createBooking,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TENANT_A = OPERATOR_SMOKE.tenantId;
const TENANT_B = "00000000-0000-4000-8000-000000000015";
const FOREIGN_TENANT = "00000000-0000-4000-8000-000000000003";

function opsAuth(tenantId: string) {
  return {
    tenantId,
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin" as const,
    status: "ACTIVE" as const,
  };
}

describe("BK outbox tenant boundaries", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("BookingRepositoryPort no longer exposes listOutboxByAggregate", () => {
    const port = readFileSync(join(here, "ports/booking-repository.port.ts"), "utf8");
    assert.doesNotMatch(port, /listOutboxByAggregate/);

    const prisma = readFileSync(join(here, "prisma-bookings.repository.ts"), "utf8");
    assert.doesNotMatch(prisma, /listOutboxByAggregate/);
    assert.doesNotMatch(prisma, /getPrismaAdmin/);
  });

  it("approve emission + reaction stay tenant-scoped (tenantId on outbox and reaction input)", async () => {
    const created = await createBooking(opsAuth(TENANT_A), {
      tourId: "00000000-0000-4000-8000-000000000901",
      tourTitle: "Outbox Boundary Tour",
      guestLabel: "Outbox Guest",
      guestEmail: "outbox-boundary@example.com",
      partySize: 1,
      departureAt: "2026-12-15T10:00:00.000Z",
      registrationIntake: { tourCapacityMax: 10 },
    });
    await approveBooking(opsAuth(TENANT_A), created.id);

    const rows = await peekOutboxByAggregateForTests({
      tenantId: TENANT_A,
      aggregateId: created.id,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.tenantId, TENANT_A);
    assert.equal(rows[0]?.aggregateId, created.id);
    assert.equal(rows[0]?.eventType, "registration.approved");

    const serviceSrc = readFileSync(join(here, "bookings.service.ts"), "utf8");
    assert.match(serviceSrc, /reactAfterApprove\(\{[\s\S]*tenantId/);
    assert.match(serviceSrc, /approveWithOutbox\(\{[\s\S]*tenantId: auth\.tenantId/);
  });

  it("cross tenant aggregate id cannot resolve outbox rows", async () => {
    const created = await createBooking(opsAuth(TENANT_A), {
      tourId: "00000000-0000-4000-8000-000000000902",
      tourTitle: "Cross Tenant Outbox Tour",
      guestLabel: "Cross Tenant Guest",
      guestEmail: "outbox-cross@example.com",
      partySize: 1,
      departureAt: "2026-12-16T10:00:00.000Z",
      registrationIntake: { tourCapacityMax: 10 },
    });
    await approveBooking(opsAuth(TENANT_A), created.id);

    const owner = await peekOutboxByAggregateForTests({
      tenantId: TENANT_A,
      aggregateId: created.id,
    });
    assert.equal(owner.length, 1);

    const foreign = await peekOutboxByAggregateForTests({
      tenantId: FOREIGN_TENANT,
      aggregateId: created.id,
    });
    assert.deepEqual(foreign, []);

    const otherWs = await peekOutboxByAggregateForTests({
      tenantId: TENANT_B,
      aggregateId: created.id,
    });
    assert.deepEqual(otherWs, []);
  });
});
