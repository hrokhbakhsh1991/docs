/**
 * DP1-A — Payment Hold repository (memory driver; Prisma parity via schema migration).
 */
import {
  InMemoryPaymentHoldRepository,
  resetInMemoryPaymentHoldRepositoryForTests,
  type PaymentHoldRow,
} from "@app-tour/finance-core/infrastructure/in-memory-payment-hold.repository";

export type { PaymentHoldRow };

let singleton: InMemoryPaymentHoldRepository | null = null;

export function getPaymentHoldRepository(): InMemoryPaymentHoldRepository {
  if (singleton === null) {
    singleton = new InMemoryPaymentHoldRepository();
  }
  return singleton;
}

export function resetPaymentHoldRepositoryForTests(): void {
  resetInMemoryPaymentHoldRepositoryForTests();
  singleton = new InMemoryPaymentHoldRepository();
}
