import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, before } from "node:test";

import {
  buildObligationOverrideIntakeValue,
  OBLIGATION_OVERRIDE_INTAKE_KEY,
} from "@app-tour/finance-core";
import { flushDomainEventDispatch } from "@app-tour/platform-events";

import { reclaimStaleProcessingOutboxRows } from "../src/outbox/outbox-processing-reclaim";
import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import type { TourStorageRepository } from "../src/db/tour.repository";
import { clearPreTransactionValidationGate } from "../src/canonical/pre-transaction-validation";
import { resetValidationSchedulerForTests } from "../src/canonical/validation-scheduler";
import { disconnectPrisma } from "../src/db/prisma";
import { resetBookingsRepositorySingletonForTests } from "../src/bookings/create-bookings-repository";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetIdentityRepositorySingletonForTests } from "../src/identity/create-identity-repository";
import { resetSettingsResourcesRepositorySingletonForTests } from "../src/settings/create-settings-resources-repository";
import { resetFinanceScheduleStoreForTests } from "../src/workspace-finance/finance-schedule-store";
import { resetTenantRouteLookupCacheForTests } from "../src/tenant/tenant-route-lookup";
import { resetTenantRegistryCacheForTests } from "../src/tenant/tenant-registry-cache";
import { createTourStorageRepository } from "../src/storage/create-tour-storage";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { ToursService } from "../src/tours/tours.service";
import {
  resolveWorkspaceTypeForTenant,
  WORKSPACE_TYPE_UNRESOLVED,
} from "../src/tenant/resolve-workspace-type";

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

/**
 * Postgres finance HTTP specs — operator obligation without seeding tour pricing.
 * Matches commercial-quote freeze + manual payment debt gate expectations.
 */
export function postgresFinanceObligationIntake(
  obligationMinor: string,
  setByUserId = "postgres-finance-test-setter"
): Record<string, unknown> {
  return {
    [OBLIGATION_OVERRIDE_INTAKE_KEY]: buildObligationOverrideIntakeValue({
      obligationMinor,
      setAt: "2026-08-01T00:00:00.000Z",
      setByUserId,
    }),
  };
}

export function createTestToursService(
  store: TourStorageRepository = new InMemoryTourRepository()
): ToursService {
  if (store instanceof InMemoryTourRepository) {
    store.ensureUrbanPhase81PublishedTour();
  }
  return new ToursService(
    new CanonicalTourService(new TourStorageDbAdapter(store), new LegacyCanonicalAdapter()),
    {
      resolveWorkspaceType: async (tenantId) => {
        try {
          return await resolveWorkspaceTypeForTenant(tenantId);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === `${WORKSPACE_TYPE_UNRESOLVED}:${tenantId}`
          ) {
            return "starter";
          }
          throw error;
        }
      },
    }
  );
}

/**
 * Shared memory tour store for HTTP + finance obligation (same singleton as
 * `createFinanceObligationPort` → `createTourStorageRepository()`).
 * Private `new InMemoryTourRepository()` leaves finance unable to resolve tour
 * pricing → invoice balance 0 → member receipt POST 400.
 */
export function createSharedMemoryTourStoreForHttpTests(options?: {
  readonly seedOperatorSmoke?: boolean;
}): InMemoryTourRepository {
  const store = createTourStorageRepository();
  if (!(store instanceof InMemoryTourRepository)) {
    throw new Error(
      "createSharedMemoryTourStoreForHttpTests requires STORAGE_DRIVER=memory"
    );
  }
  if (options?.seedOperatorSmoke !== false) {
    store.ensureOperatorSmokeSeedTour();
  }
  return store;
}

/**
 * HTTP specs using {@link createTestToursService} with in-memory storage must pin
 * `STORAGE_DRIVER=memory` even when the outer gate exports `STORAGE_DRIVER=prisma`.
 */
export function installMemoryStorageDriverForDescribe(): void {
  const prior = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorDatabaseUrlAdmin = process.env.DATABASE_URL_ADMIN;
  const priorRedisUrl = process.env.REDIS_URL;
  const priorRelay = process.env.OUTBOX_RELAY_ENABLED;
  const priorReconcile = process.env.PROJECTION_AUTO_RECONCILE_ENABLED;
  const priorValidationWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_ADMIN;
    delete process.env.REDIS_URL;
    process.env.OUTBOX_RELAY_ENABLED = "false";
    process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";
    resetBookingsRepositorySingletonForTests();
    resetIdentityRepositorySingletonForTests();
    resetSettingsResourcesRepositorySingletonForTests();
    resetLazyFinanceServiceForTests();
    resetFinanceScheduleStoreForTests();
  });
  after(() => {
    if (prior === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = prior;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
    if (priorDatabaseUrlAdmin === undefined) {
      delete process.env.DATABASE_URL_ADMIN;
    } else {
      process.env.DATABASE_URL_ADMIN = priorDatabaseUrlAdmin;
    }
    if (priorRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = priorRedisUrl;
    }
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
    if (priorValidationWorkers === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = priorValidationWorkers;
    }
    resetBookingsRepositorySingletonForTests();
    resetIdentityRepositorySingletonForTests();
    resetLazyFinanceServiceForTests();
    resetFinanceScheduleStoreForTests();
  });
}

/**
 * Postgres HTTP integration — reset singletons and ALS-adjacent schedulers that can leak
 * across node:test files when CI pins `STORAGE_DRIVER=prisma` for the full suite.
 */
export async function preparePostgresHttpIntegration(): Promise<void> {
  resetValidationSchedulerForTests();
  resetTenantRouteLookupCacheForTests();
  resetTenantRegistryCacheForTests();
  clearPreTransactionValidationGate();
  resetBookingsRepositorySingletonForTests();
  resetIdentityRepositorySingletonForTests();
  await disconnectPrisma();
}

/** Assert GET /health 200 body — allows optional prisma `checks.database` when STORAGE_DRIVER=prisma. */
export function assertOkHealthBody(body: unknown): void {
  assert.equal((body as { status?: string }).status, "ok");
  assert.equal((body as { service?: string }).service, "@apps/api");
  const checks = (body as { checks?: { database?: { status?: string } } }).checks;
  if (checks?.database !== undefined) {
    assert.equal(checks.database.status, "ok");
  }
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
