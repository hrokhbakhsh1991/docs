import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it, beforeEach } from "node:test";

import {
  resetDomainEventBusForTests,
  subscribeDomainEvent,
  subscribeDomainEventForTenant,
} from "@app-tour/platform-events";

import { createApiAbility } from "../casl/api-ability";
import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { TourStorageDbAdapter } from "../db/tour-storage.adapter";
import { withTenantRls } from "../db/with-tenant-rls";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import { PrismaTourRepository } from "../storage/prisma-tour.repository";
import { CanonicalTourService } from "./canonical-tour.service";
import { LegacyCanonicalAdapter } from "./legacy-canonical-adapter";
import { publishTourCreatedEvent } from "./publish-tour-created";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/** UUID v4 whose first hex digit is a letter (platform-core RuleContext). */
function postgresCompatibleTenantId(): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const id = randomUUID();
    if (/^[a-f]/i.test(id)) {
      return id;
    }
  }
  throw new Error("postgresCompatibleTenantId: could not generate compatible UUID");
}

function memberAbility(tenantId: string) {
  return createApiAbility({
    userId: "u1",
    tenantId,
    workspaceId: "ws-1",
    role: "admin",
    status: "ACTIVE",
  });
}

const validBody = {
  data: { basics: { title: "E2E" }, details: { summary: "ok" } },
} as const;

describe("CanonicalTourService TourCreated event", () => {
  const priorStorage = process.env.STORAGE_DRIVER;

  beforeEach(() => {
    resetDomainEventBusForTests();
    process.env.STORAGE_DRIVER = "memory";
  });

  after(() => {
    process.env.STORAGE_DRIVER = priorStorage;
  });

  it("P4-E-EVT-01: publishes TourCreated with tenantId", async () => {
    const seen: string[] = [];
    subscribeDomainEvent("TourCreated", (evt) => {
      seen.push(evt.tenantId);
    });

    const service = new CanonicalTourService(
      new TourStorageDbAdapter(new InMemoryTourRepository()),
      new LegacyCanonicalAdapter()
    );

    await service.writeTour({
      ability: memberAbility("tenant-a"),
      tenantId: "tenant-a",
      workspaceType: "starter",
      body: validBody,
    });

    assert.deepEqual(seen, ["tenant-a"]);
  });

  it("P4-E-EVT-01: tenant-b subscriber does not receive tenant-a TourCreated", async () => {
    const tenantBSeen: string[] = [];
    subscribeDomainEventForTenant("tenant-b", "TourCreated", (evt) => {
      tenantBSeen.push(evt.tenantId);
    });

    const service = new CanonicalTourService(
      new TourStorageDbAdapter(new InMemoryTourRepository()),
      new LegacyCanonicalAdapter()
    );

    await runWithTenantContext("tenant-a", async () =>
      service.writeTour({
        ability: memberAbility("tenant-a"),
        tenantId: "tenant-a",
        workspaceType: "starter",
        body: validBody,
      })
    );

    assert.deepEqual(tenantBSeen, []);
  });

  it("P4-E-EVT-01: rejects cross-tenant publish when ALS tenant disagrees", () => {
    assert.throws(
      () =>
        runWithTenantContext("tenant-b", () => {
          publishTourCreatedEvent({
            tenantId: "tenant-a",
            tourId: randomUUID(),
          });
        }),
      /DOMAIN_EVENT_CROSS_TENANT_FORBIDDEN/
    );
  });
});

describe("CanonicalTourService TourCreated (Postgres path)", { skip: !hasDatabase }, () => {
  beforeEach(() => {
    resetDomainEventBusForTests();
  });

  it("P5-4-S1: Postgres persist enqueues TourCreated outbox row (no in-process publish)", async () => {
    const tenantId = postgresCompatibleTenantId();
    const subdomain = `evt-${tenantId.slice(0, 8)}`;
    const priorStorage = process.env.STORAGE_DRIVER;
    process.env.STORAGE_DRIVER = "prisma";
    const admin = getPrismaAdmin();
    await admin.tenant.create({
      data: {
        id: tenantId,
        subdomain,
        workspaceType: "starter",
        status: "active",
        theme: {},
      },
    });

    const seen: string[] = [];
    subscribeDomainEvent("TourCreated", (evt) => {
      seen.push(evt.tenantId);
    });

    const service = new CanonicalTourService(
      new TourStorageDbAdapter(new PrismaTourRepository()),
      new LegacyCanonicalAdapter()
    );

    try {
      const record = await service.writeTour({
        ability: memberAbility(tenantId),
        tenantId,
        workspaceType: "starter",
        body: validBody,
      });
      assert.deepEqual(seen, [], "Prisma path must not publish in-process before relay");
      const outbox = await admin.outboxEvent.findMany({ where: { tenantId } });
      assert.equal(outbox.length, 1);
      assert.equal(outbox[0]?.eventType, "TourCreated");
      assert.equal(outbox[0]?.aggregateId, record.id);
      assert.equal(outbox[0]?.status, "pending");
    } finally {
      process.env.STORAGE_DRIVER = priorStorage;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
    }
  });
});
