import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER } from "../storage/dual-store-role";
import {
  InMemorySettingsResourcesRepository,
  resetSettingsResourcesRepositoryForTests,
  type SettingsResourcesRepository,
} from "./in-memory-settings-resources.repository";
import { PrismaSettingsResourcesRepository } from "./prisma-settings-resources.repository";

/** PSR-5h — InMemory branch retained as explicit test|dev adapter. */
export const DUAL_STORE_ROLE = DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;

let singleton: SettingsResourcesRepository | null = null;

export function getSettingsResourcesRepository(): SettingsResourcesRepository {
  assertProductionStorageDriver();

  if (singleton === null) {
    if (resolveStorageDriver() === "prisma") {
      if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
        throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for settings resources repository");
      }
      singleton = new PrismaSettingsResourcesRepository();
    } else {
      singleton = new InMemorySettingsResourcesRepository();
    }
  }
  return singleton!;
}

export function resetSettingsResourcesRepositorySingletonForTests(): void {
  resetSettingsResourcesRepositoryForTests();
  singleton = null;
}
