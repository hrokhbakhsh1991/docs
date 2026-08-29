/**
 * DP1-A — Payment Hold repository.
 */
import {
  InMemoryPaymentHoldRepository,
  resetInMemoryPaymentHoldRepositoryForTests,
  type PaymentHoldRow,
} from "@app-tour/finance-core/infrastructure/in-memory-payment-hold.repository";

import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
import { PrismaPaymentHoldRepository } from "./prisma-payment-hold.repository.ts";

export type { PaymentHoldRow };

type PaymentHoldRepository = InMemoryPaymentHoldRepository | PrismaPaymentHoldRepository;

let singleton: PaymentHoldRepository | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getPaymentHoldRepository(): PaymentHoldRepository {
  const driver = resolveStorageDriver();
  if (singleton !== null && singletonDriver === driver) {
    return singleton;
  }

  singleton = driver === "prisma" ? new PrismaPaymentHoldRepository() : new InMemoryPaymentHoldRepository();
  singletonDriver = driver;
  return singleton;
}

export function resetPaymentHoldRepositoryForTests(): void {
  resetInMemoryPaymentHoldRepositoryForTests();
  singleton = new InMemoryPaymentHoldRepository();
  singletonDriver = "memory";
}
