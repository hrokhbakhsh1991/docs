import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";

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
  const outbox = new OutboxService(metrics);

  await assert.rejects(
    async () => {
      await dataSource.transaction(async (m) => {
        await m.save({ domain: "dummy" });
        await outbox.addEvent(m, {
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
