import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
import { FinanceRepository } from "./finance.repository";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository";

export type FinanceRepositoryPort = FinanceRepository | InMemoryFinanceRepository;

let financeRepositorySingleton: FinanceRepositoryPort | null = null;

export function createFinanceRepository(): FinanceRepositoryPort {
  if (financeRepositorySingleton !== null) {
    return financeRepositorySingleton;
  }
  if (resolveStorageDriver() === "memory") {
    financeRepositorySingleton = new InMemoryFinanceRepository();
  } else {
    financeRepositorySingleton = new FinanceRepository();
  }
  return financeRepositorySingleton;
}

export function resetFinanceRepositoryForTests(): void {
  financeRepositorySingleton = null;
}
