import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER } from "../storage/dual-store-role";
import {
  InMemorySettingsConfigRepository,
  resetSettingsConfigRepositoryForTests,
  type SettingsConfigRepository,
} from "./in-memory-settings-config.repository";
import { PrismaSettingsConfigRepository } from "./prisma-settings-config.repository";

/** PSR-5h — InMemory branch retained as explicit test|dev adapter. */
export const DUAL_STORE_ROLE = DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;

let singleton: SettingsConfigRepository | null = null;

export function getSettingsConfigRepository(): SettingsConfigRepository {
  assertProductionStorageDriver();

  if (singleton === null) {
    if (resolveStorageDriver() === "prisma") {
      if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
        throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for settings config repository");
      }
      singleton = new PrismaSettingsConfigRepository();
    } else {
      singleton = new InMemorySettingsConfigRepository();
    }
  }
  return singleton;
}

export function resetSettingsConfigRepositorySingletonForTests(): void {
  resetSettingsConfigRepositoryForTests();
  singleton = null;
}
