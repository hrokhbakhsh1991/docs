import { PaymentStatus } from "@repo/shared-contracts";
import { PaymentMethod } from "../../src/modules/payments/entities/payment.entity";

/** Valid v4 UUIDs for finance contract validation in unit tests. */
export const TEST_PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const TEST_TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const TEST_REGISTRATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const TEST_TOUR_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
export const TEST_REGISTRATION_ID_2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const TEST_PAYMENT_ID_2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const DEFAULT_CREATED = new Date("2026-01-01T00:00:00.000Z");

/** Minimal {@link PaymentEntity}-shaped row that passes {@link enforcePaymentIntentFinanceContract}. */
export function paymentEntityContractFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: TEST_PAYMENT_ID,
    tenantId: TEST_TENANT_ID,
    registrationId: TEST_REGISTRATION_ID,
    amount: "100",
    currency: "IRR",
    method: PaymentMethod.ONLINE,
    provider: "zibal",
    providerPaymentId: "provider-1",
    status: PaymentStatus.PENDING,
    paidAt: null,
    failedAt: null,
    refundedAt: null,
    ledgerJournalId: null,
    createdAt: DEFAULT_CREATED,
    updatedAt: DEFAULT_CREATED,
    deletedAt: null,
    ...overrides,
  };
}
