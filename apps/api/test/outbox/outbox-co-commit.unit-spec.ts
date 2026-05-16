import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import type { FinancialMutationAuditService } from "../../src/common/audit/financial-mutation-audit.service";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";

function noopFinancialAudit(): FinancialMutationAuditService {
  return {
    recordOutboxFinancialMutation: async () => {}
  } as unknown as FinancialMutationAuditService;
}

test("domain + outbox rolls back together when transaction aborts", async () => {
  const persisted: unknown[] = [];
  const manager = {
    create(_cls: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    async save(entity: unknown) {
      persisted.push(entity);
      return entity;
    }
  } as unknown as EntityManager;

  const dataSource = {
    async transaction<T>(_fn: (m: EntityManager) => Promise<T>): Promise<T> {
      const snapshot = persisted.length;
      try {
        return await _fn(manager);
      } catch {
        persisted.splice(snapshot);
        throw new Error("rolled back");
      }
    }
  };

  const metrics = new OutboxMetricsService();
  const outbox = new OutboxService(metrics, noopFinancialAudit());

  await assert.rejects(
    async () => {
      await dataSource.transaction(async (m) => {
        await m.save({ domain: "dummy" });
        await outbox.addEvent(m, {
          tenantId: "66666666-6666-4666-8666-666666666666",
          aggregateType: "Registration",
          aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          eventType: "registration.accepted",
          payload: {}
        });
        throw new Error("boom");
      });
    },
    (error: unknown) => error instanceof Error && error.message === "rolled back"
  );

  assert.equal(persisted.length, 0);
});
