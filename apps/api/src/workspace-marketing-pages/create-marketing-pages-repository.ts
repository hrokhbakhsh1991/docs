import { assertProductionStorageDriver, resolveStorageDriver } from "../storage/production-storage-driver-assert";
import {
  InMemoryMarketingPagesRepository,
  resetMarketingPagesRepositoryForTests,
  type MarketingPagesRepository,
} from "./in-memory-marketing-pages.repository";
import { PrismaMarketingPagesRepository } from "./prisma-marketing-pages.repository";

let singleton: MarketingPagesRepository | null = null;

export function getMarketingPagesRepository(): MarketingPagesRepository {
  assertProductionStorageDriver();
  if (singleton === null) {
    if (resolveStorageDriver() === "prisma") {
      if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
        throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for marketing pages repository");
      }
      singleton = new PrismaMarketingPagesRepository();
    } else {
      singleton = new InMemoryMarketingPagesRepository();
    }
  }
  return singleton;
}

export function resetMarketingPagesRepositorySingletonForTests(): void {
  resetMarketingPagesRepositoryForTests();
  singleton = null;
}
