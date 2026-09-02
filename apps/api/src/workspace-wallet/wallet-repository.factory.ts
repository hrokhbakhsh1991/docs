import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { PrismaWalletRepository } from "./infrastructure/prisma-wallet.repository";

let walletRepositorySingleton: PrismaWalletRepository | null = null;

export function createWalletRepository(): PrismaWalletRepository {
  assertProductionStorageDriver();
  if (walletRepositorySingleton !== null) {
    return walletRepositorySingleton;
  }
  if (resolveStorageDriver() === "memory") {
    throw new Error(
      "WALLET_REPOSITORY_PRISMA_REQUIRED: wallet persistence requires STORAGE_DRIVER=prisma",
    );
  }
  walletRepositorySingleton = new PrismaWalletRepository();
  return walletRepositorySingleton;
}

export function resetWalletRepositoryForTests(): void {
  walletRepositorySingleton = null;
}
