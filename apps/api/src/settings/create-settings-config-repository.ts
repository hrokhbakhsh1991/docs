import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemorySettingsConfigRepository,
  resetSettingsConfigRepositoryForTests,
  type SettingsConfigRepository,
} from "./in-memory-settings-config.repository";
import { PrismaSettingsConfigRepository } from "./prisma-settings-config.repository";

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
