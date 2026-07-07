import type { Tour, TourStorageRepository } from "./tour-storage.interface";
import { OPERATOR_DENALI_SMOKE_TENANT_ID } from "../internal/operator-smoke-tenant-id";
import type { TourStorageRepository as DbTourStorageRepository } from "../db/tour.repository";
import { TourStorageDbAdapter } from "../db/tour-storage.adapter";
import { InMemoryTourRepository } from "./in-memory-tour.repository";
import { PrismaTourRepository } from "./prisma-tour.repository";
import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "./production-storage-driver-assert";

export type { TourStorageDriver } from "./production-storage-driver-assert";
export {
  PRODUCTION_DATABASE_URL_REQUIRED,
  PRODUCTION_STORAGE_DRIVER_FORBIDDEN,
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "./production-storage-driver-assert";

export type TourStorageImplementation = TourStorageRepository & {
  createTour(data: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour>;
};

let urbanSmokeMemoryStore: InMemoryTourRepository | undefined;
let operatorSmokeMemoryStore: InMemoryTourRepository | undefined;
let dualSmokeMemoryStore: InMemoryTourRepository | undefined;
let defaultMemoryTourStore: InMemoryTourRepository | undefined;

/**
 * DI factory — `STORAGE_DRIVER=memory|prisma` or NODE_ENV default (test→memory, production→prisma).
 * Production refuses memory driver and missing DATABASE_URL before constructing a repository.
 */
export function createTourStorageRepository(): TourStorageImplementation {
  assertProductionStorageDriver();

  const driver = resolveStorageDriver();
  if (driver === "prisma") {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
      throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL");
    }
    return new PrismaTourRepository();
  }
  if (
    process.env.URBAN_SMOKE_E2E_SEED === "1" &&
    process.env.OPERATOR_SMOKE_E2E_SEED === "1"
  ) {
    if (dualSmokeMemoryStore === undefined) {
      dualSmokeMemoryStore = new InMemoryTourRepository();
      dualSmokeMemoryStore.ensureUrbanPhase81PublishedTour();
      dualSmokeMemoryStore.ensureOperatorSmokeSeedTour();
      if (!isProductionAuthMode()) {
        dualSmokeMemoryStore.ensureDenaliDevSmokeSeedTour();
      }
    }
    return dualSmokeMemoryStore;
  }
  if (process.env.URBAN_SMOKE_E2E_SEED === "1") {
    if (urbanSmokeMemoryStore === undefined) {
      urbanSmokeMemoryStore = new InMemoryTourRepository();
      urbanSmokeMemoryStore.ensureUrbanPhase81PublishedTour();
    }
    return urbanSmokeMemoryStore;
  }
  if (process.env.OPERATOR_SMOKE_E2E_SEED === "1") {
    if (operatorSmokeMemoryStore === undefined) {
      operatorSmokeMemoryStore = new InMemoryTourRepository();
      operatorSmokeMemoryStore.ensureOperatorSmokeSeedTour();
      if (!isProductionAuthMode()) {
        operatorSmokeMemoryStore.ensureDenaliDevSmokeSeedTour();
      }
    }
    return operatorSmokeMemoryStore;
  }
  if (defaultMemoryTourStore === undefined) {
    defaultMemoryTourStore = new InMemoryTourRepository();
    if (!isProductionAuthMode()) {
      defaultMemoryTourStore.ensureDenaliDevSmokeSeedTour();
    }
  }
  return defaultMemoryTourStore;
}

/** Dev memory — idempotent Denali smoke tours for tenant …000003 (FE-14 / TR-09). */
export function ensureDevMemoryTourSeedForTenant(
  tenantId: string,
  store?: TourStorageRepository | DbTourStorageRepository
): void {
  if (isProductionAuthMode()) {
    return;
  }
  if (tenantId !== OPERATOR_DENALI_SMOKE_TENANT_ID) {
    return;
  }
  const memoryStore = resolveDevMemoryTourStore(store);
  memoryStore?.ensureDenaliDevSmokeSeedTour();
}

function resolveDevMemoryTourStore(
  store?: TourStorageRepository | DbTourStorageRepository
): InMemoryTourRepository | null {
  if (store instanceof InMemoryTourRepository) {
    return store;
  }
  if (store instanceof TourStorageDbAdapter) {
    return store.devMemoryStore();
  }
  if (store !== undefined) {
    return null;
  }
  if (resolveStorageDriver() !== "memory") {
    return null;
  }
  const fallback = createTourStorageRepository();
  return fallback instanceof InMemoryTourRepository ? fallback : null;
}

/** Phase 5.4-S1 — atomic tour + projection columns + outbox (Prisma only). */
export function useAtomicCanonicalPersist(): boolean {
  return resolveStorageDriver() === "prisma" && Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Forensic storage — Postgres atomic TX with `audit_events` + outbox SoT (DEC-045 / AUDIT-GAP-01).
 * Memory driver is intentionally non-forensic (unit/local speed); forbidden in production.
 * @see docs/phase-4/appendices/storage-driver-truth.md
 */
export function isForensicStorageDriver(): boolean {
  return useAtomicCanonicalPersist();
}
