import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { hasWorkspaceFinanceProcessedEvent } from "../src/workspace-finance/workspace-finance-processed-log";
import {
  processWorkspaceFinanceOutboxForTenant,
  processWorkspaceFinanceTourCreatedRow,
} from "../src/workspace-finance/process-workspace-finance-outbox";
import { integrationTenantId, preparePostgresOutboxIsolation } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

describe(
  "denali-finance-outbox.integration.spec.ts (REQ-P6-011, BLOCKER-P6-OUTBOX-5.4)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const tourId = randomUUID();
    const domainEventId = randomUUID();
    const registrationId = randomUUID();
    let admin: ReturnType<typeof getPrismaAdmin>;

    beforeEach(async () => {
      await preparePostgresOutboxIsolation();
      admin = getPrismaAdmin();
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
    });

    before(async () => {
      await preparePostgresOutboxIsolation();
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `dfin-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
    });

    after(async () => {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
    });

    it("P6-4: TourCreated with finance payload enqueues finance.ledger.double_entry_applied", async () => {
      await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: tourId,
          eventType: "TourCreated",
          domainEventId,
          status: "done",
          payload: {
            tenantId,
            tourId,
            registrationId,
            paidAmountMinor: "2500",
            currency: "USD",
          },
        },
      });

      const handled = await processWorkspaceFinanceTourCreatedRow({
        tenantId,
        domainEventId,
        eventType: "TourCreated",
        aggregateType: "tour",
        aggregateId: tourId,
        payload: {
          tenantId,
          tourId,
          registrationId,
          paidAmountMinor: "2500",
          currency: "USD",
        },
      });

      assert.equal(handled, true);

      const financeRows = await admin.outboxEvent.findMany({
        where: {
          tenantId,
          eventType: "finance.ledger.double_entry_applied",
        },
      });
      assert.equal(financeRows.length, 1);
      const financePayload = financeRows[0]?.payload as { registrationId?: string };
      assert.equal(financePayload.registrationId, registrationId);

      const replay = await processWorkspaceFinanceTourCreatedRow({
        tenantId,
        domainEventId,
        eventType: "TourCreated",
        aggregateType: "tour",
        aggregateId: tourId,
        payload: {
          tenantId,
          tourId,
          registrationId,
          paidAmountMinor: "2500",
          currency: "USD",
        },
      });
      assert.equal(replay, false);
      assert.equal(
        (
          await admin.outboxEvent.findMany({
            where: { tenantId, eventType: "finance.ledger.double_entry_applied" },
          })
        ).length,
        1
      );
    });

    it("P6-4: batch consumer uses Prisma reader/writer with persistent idempotency", async () => {
      const secondDomainEventId = randomUUID();
      await admin.outboxEvent.createMany({
        data: [
          {
            tenantId,
            aggregateType: "tour",
            aggregateId: randomUUID(),
            eventType: "TourCreated",
            domainEventId: secondDomainEventId,
            status: "pending",
            payload: {
              tenantId,
              registrationId,
              paidAmountMinor: "100",
            },
          },
        ],
      });

      const first = await processWorkspaceFinanceOutboxForTenant(tenantId);
      assert.equal(first.handled, 1);

      assert.equal(await hasWorkspaceFinanceProcessedEvent(tenantId, secondDomainEventId), true);

      const second = await processWorkspaceFinanceOutboxForTenant(tenantId);
      assert.equal(second.handled, 0);
      assert.equal(second.skipped, 0);
    });
  }
);
