import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { FinanceRepository } from "./finance.repository";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository";

export type FinanceRepositoryPort = FinanceRepository | InMemoryFinanceRepository;

let singleton: FinanceRepositoryPort | null = null;

export function getFinanceRepository(): FinanceRepositoryPort {
  assertProductionStorageDriver();

  if (singleton === null) {
    if (resolveStorageDriver() === "prisma") {
      if (!process.env.DATABASE_URL?.trim()) {
        throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for finance repository");
      }
      singleton = new FinanceRepository();
    } else {
      singleton = new InMemoryFinanceRepository();
    }
  }
  return singleton;
}

export function resetFinanceRepositoryForTests(): void {
  singleton = null;
}
