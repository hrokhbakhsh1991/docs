import { requiresProductionGradeIntegrity } from "../server/runtime-profile";

export type TourStorageDriver = "memory" | "prisma";

export const PRODUCTION_DATABASE_URL_REQUIRED = "PRODUCTION_DATABASE_URL_REQUIRED";
export const PRODUCTION_STORAGE_DRIVER_FORBIDDEN = "PRODUCTION_STORAGE_DRIVER_FORBIDDEN";

/**
 * Resolve tour/booking storage driver.
 * Explicit STORAGE_DRIVER wins; else prisma when DATABASE_URL is set (PREV-AUD-009);
 * else production→prisma, otherwise memory.
 * @see docs/phase-20/p7/appendices/BOOKING_REMEDIATION_TODO_009_STORAGE_DEFAULT.md
 */
export function resolveStorageDriver(): TourStorageDriver {
  const explicit = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (explicit === "memory" || explicit === "prisma") {
    return explicit;
  }
  if (process.env.DATABASE_URL?.trim()) {
    return "prisma";
  }
  return requiresProductionGradeIntegrity() || process.env.NODE_ENV === "production"
    ? "prisma"
    : "memory";
}

/**
 * Fail-closed production / prodlike storage guard (DEC-GAP-03 / DM-CT-01 / DI-MEM-01).
 * No harness bypass — production never permits memory storage.
 */
export function assertProductionStorageDriver(): void {
  if (!requiresProductionGradeIntegrity()) {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(PRODUCTION_DATABASE_URL_REQUIRED);
  }

  if (resolveStorageDriver() === "memory") {
    throw new Error(PRODUCTION_STORAGE_DRIVER_FORBIDDEN);
  }
}
