import { randomUUID } from "node:crypto";
import { after, before } from "node:test";

import { flushDomainEventDispatch } from "@app-tour/platform-events";

import { reclaimStaleProcessingOutboxRows } from "../src/outbox/outbox-processing-reclaim";
import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import type { TourStorageRepository } from "../src/db/tour.repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { ToursService } from "../src/tours/tours.service";

/**
 * Postgres integration tenant id — UUID v4 whose first hex digit is a letter (platform-core RuleContext).
 */
export function integrationTenantId(): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const id = randomUUID();
    if (/^[a-f]/i.test(id)) {
      return id;
    }
  }
  throw new Error("integrationTenantId: could not generate platform-core-compatible UUID");
}

export function createTestToursService(
  store: TourStorageRepository = new InMemoryTourRepository()
): ToursService {
  return new ToursService(
    new CanonicalTourService(new TourStorageDbAdapter(store), new LegacyCanonicalAdapter())
  );
}

/**
 * HTTP specs using {@link createTestToursService} with in-memory storage must pin
 * `STORAGE_DRIVER=memory` even when the outer gate exports `STORAGE_DRIVER=prisma`.
 */
export function installMemoryStorageDriverForDescribe(): void {
  const prior = process.env.STORAGE_DRIVER;
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
  });
  after(() => {
    if (prior === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = prior;
    }
  });
}

/**
 * Await deferred domain-event bus dispatch plus async idempotent handler work (DB claim + side effects).
 * Prefer over raw `setImmediate` loops — {@link publishDomainEvent} schedules handlers on `setImmediate`.
 */
export async function drainDomainEventHandlers(rounds = 64): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await flushDomainEventDispatch();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  // Idempotent subscribers run async DB claims after deferred bus dispatch.
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
}

/**
 * Force in-process outbox relay and projection auto-reconcile off for deterministic integration tests.
 */
export function stabilizeOutboxRelayTestEnv(): { restore: () => void } {
  const priorRelay = process.env.OUTBOX_RELAY_ENABLED;
  const priorReconcile = process.env.PROJECTION_AUTO_RECONCILE_ENABLED;
  process.env.OUTBOX_RELAY_ENABLED = "false";
  process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";
  return {
    restore: () => {
      if (priorRelay === undefined) {
        delete process.env.OUTBOX_RELAY_ENABLED;
      } else {
        process.env.OUTBOX_RELAY_ENABLED = priorRelay;
      }
      if (priorReconcile === undefined) {
        delete process.env.PROJECTION_AUTO_RECONCILE_ENABLED;
      } else {
        process.env.PROJECTION_AUTO_RECONCILE_ENABLED = priorReconcile;
      }
    },
  };
}

/** Reclaim stale `processing` outbox rows so relay claims are not blocked by prior test pollution. */
export async function quiesceStaleOutboxProcessing(reclaimMs = 0): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }
  await reclaimStaleProcessingOutboxRows(reclaimMs);
}

/** Stabilize relay env vars and quiesce stale processing before Postgres outbox integration tests. */
export async function preparePostgresOutboxIsolation(): Promise<void> {
  stabilizeOutboxRelayTestEnv();
  await quiesceStaleOutboxProcessing(0);
}
