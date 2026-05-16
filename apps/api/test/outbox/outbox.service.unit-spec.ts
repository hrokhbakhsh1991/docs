import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import type { FinancialMutationAuditService } from "../../src/common/audit/financial-mutation-audit.service";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";
import { OutboxEventStatus } from "../../src/common/outbox/entities/outbox-event.entity";

function noopFinancialAudit(): FinancialMutationAuditService {
  return {
    recordOutboxFinancialMutation: async () => {}
  } as unknown as FinancialMutationAuditService;
}

test("OutboxService.addEvent uses provided EntityManager.save", async () => {
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

  const metrics = new OutboxMetricsService();
  const service = new OutboxService(metrics, noopFinancialAudit());
  await service.addEvent(manager, {
    tenantId: "55555555-5555-4555-8555-555555555555",
    aggregateType: "Registration",
    aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventType: "registration.accepted",
    payload: { entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
  });

  assert.equal(persisted.length, 1);
  const row = persisted[0] as Record<string, unknown>;
  assert.equal(row.tenantId, "55555555-5555-4555-8555-555555555555");
  assert.equal(row.aggregateType, "Registration");
  assert.equal(row.eventType, "registration.accepted");
  assert.equal(row.status, OutboxEventStatus.PENDING);
});

test("OutboxService.addEvent appends financial audit on financial outbox types", async () => {
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

  const auditCalls: unknown[] = [];
  const financialMutationAudit = {
    async recordOutboxFinancialMutation(mgr: unknown, input: unknown) {
      auditCalls.push({ mgr, input });
    }
  } as unknown as FinancialMutationAuditService;

  const metrics = new OutboxMetricsService();
  const service = new OutboxService(metrics, financialMutationAudit);
  await service.addEvent(manager, {
    tenantId: "55555555-5555-4555-8555-555555555555",
    aggregateType: "Payment",
    aggregateId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    eventType: "payment.created",
    payload: { entityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    financialAudit: { stateBefore: null, stateAfter: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } }
  });

  assert.equal(persisted.length, 1);
  assert.equal(auditCalls.length, 1);
  const call = auditCalls[0] as {
    mgr: unknown;
    input: {
      eventType: string;
      payload: { correlation_id?: string };
      financialAudit: unknown;
    };
  };
  assert.equal(call.mgr, manager);
  assert.equal(call.input.eventType, "payment.created");
  assert.equal(typeof call.input.payload.correlation_id, "string");
  assert.deepEqual(call.input.financialAudit, {
    stateBefore: null,
    stateAfter: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }
  });
});
