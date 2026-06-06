import type { Tour, TourStorageRepository } from "./tour-storage.interface";
import { InMemoryTourRepository } from "./in-memory-tour.repository";
import { PrismaTourRepository } from "./prisma-tour.repository";
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
  return new InMemoryTourRepository();
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
