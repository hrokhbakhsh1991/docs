import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER } from "../storage/dual-store-role";
import {
  InMemorySettingsAuditRepository,
  resetSettingsAuditRepositoryForTests,
  type SettingsAuditRepository,
} from "./in-memory-settings-audit.repository";
import { PrismaSettingsAuditRepository } from "./prisma-settings-audit.repository";

/** PSR-5h — InMemory branch retained as explicit test|dev adapter. */
export const DUAL_STORE_ROLE = DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;

let singleton: SettingsAuditRepository | null = null;

export function getSettingsAuditRepository(): SettingsAuditRepository {
  assertProductionStorageDriver();

  if (singleton === null) {
    if (resolveStorageDriver() === "prisma") {
      if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
        throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for settings audit repository");
      }
      singleton = new PrismaSettingsAuditRepository();
    } else {
      singleton = new InMemorySettingsAuditRepository();
    }
  }
  return singleton;
}

export function resetSettingsAuditRepositorySingletonForTests(): void {
  resetSettingsAuditRepositoryForTests();
  singleton = null;
}
