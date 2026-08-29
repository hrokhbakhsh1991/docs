/**
 * DP1-A — Payment Hold repository factory (storage driver boundary).
 */
import {
  InMemoryPaymentHoldRepository,
  resetInMemoryPaymentHoldRepositoryForTests,
  type PaymentHoldRow,
} from "@app-tour/finance-core/infrastructure/in-memory-payment-hold.repository";

import { PrismaPaymentHoldRepository } from "./prisma-payment-hold.repository";
import { resolveStorageDriver } from "./production-storage-driver-assert";

export type { PaymentHoldRow };

type PaymentHoldRepository = InMemoryPaymentHoldRepository | PrismaPaymentHoldRepository;

let singleton: PaymentHoldRepository | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getPaymentHoldRepository(): PaymentHoldRepository {
  const driver = resolveStorageDriver();
  if (singleton !== null && singletonDriver === driver) {
    return singleton;
  }

  singleton =
    driver === "prisma" ? new PrismaPaymentHoldRepository() : new InMemoryPaymentHoldRepository();
  singletonDriver = driver;
  return singleton;
}

export function resetPaymentHoldRepositoryForTests(): void {
  resetInMemoryPaymentHoldRepositoryForTests();
  singleton = new InMemoryPaymentHoldRepository();
  singletonDriver = "memory";
}
