import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemorySettingsResourcesRepository,
  resetSettingsResourcesRepositoryForTests,
  type SettingsResourcesRepository,
} from "./in-memory-settings-resources.repository";
import { PrismaSettingsResourcesRepository } from "./prisma-settings-resources.repository";

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
  return singleton;
}

export function resetSettingsResourcesRepositorySingletonForTests(): void {
  resetSettingsResourcesRepositoryForTests();
  singleton = null;
}
