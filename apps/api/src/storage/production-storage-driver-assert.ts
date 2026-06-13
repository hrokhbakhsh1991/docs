import { isProductionAuthMode } from "../tenant-kernel/auth-env";

export type TourStorageDriver = "memory" | "prisma";

export const PRODUCTION_DATABASE_URL_REQUIRED = "PRODUCTION_DATABASE_URL_REQUIRED";
export const PRODUCTION_STORAGE_DRIVER_FORBIDDEN = "PRODUCTION_STORAGE_DRIVER_FORBIDDEN";

export function resolveStorageDriver(): TourStorageDriver {
  const explicit = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (explicit === "memory" || explicit === "prisma") {
    return explicit;
  }
  return process.env.NODE_ENV === "production" ? "prisma" : "memory";
}

/**
 * Fail-closed production storage guard (DEC-GAP-03 / DM-CT-01 / DI-MEM-01).
 */
export function assertProductionStorageDriver(): void {
  if (!isProductionAuthMode()) {
    return;
  }

  // Trunk/nightly harness may simulate production auth ingress with memory storage.
  if (process.env.APPS_API_TEST_TIER?.trim()) {
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
