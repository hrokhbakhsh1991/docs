import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemorySettingsAuditRepository,
  resetSettingsAuditRepositoryForTests,
  type SettingsAuditRepository,
} from "./in-memory-settings-audit.repository";
import { PrismaSettingsAuditRepository } from "./prisma-settings-audit.repository";

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
