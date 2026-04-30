import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";
import { OutboxEventStatus } from "../../src/modules/outbox/entities/outbox-event.entity";

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
  const service = new OutboxService(metrics);
  await service.addEvent(manager, {
    aggregateType: "Registration",
    aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventType: "registration.accepted",
    payload: { entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
  });

  assert.equal(persisted.length, 1);
  const row = persisted[0] as Record<string, unknown>;
  assert.equal(row.aggregateType, "Registration");
  assert.equal(row.eventType, "registration.accepted");
  assert.equal(row.status, OutboxEventStatus.PENDING);
});
