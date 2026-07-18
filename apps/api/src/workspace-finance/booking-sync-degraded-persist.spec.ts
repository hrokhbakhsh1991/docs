/**
 * PREPAY-SYNC-DEG-PERSIST-02 — permanent degraded persist failure is observable.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics.ts";
import { FinanceService } from "./finance.service.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { BookingRegistrationDisplayAdapter } from "./infrastructure/booking-registration-display.adapter.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter.ts";
import { DenaliFinanceReceiptDefaultsAdapter } from "./infrastructure/denali-finance-receipt-defaults.adapter.ts";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository.ts";

describe("finance booking-sync degraded persist", { concurrency: false }, () => {
  it("PREPAY-SYNC-DEG-PERSIST-02 permanent failure increments metric + does not throw", async () => {
    resetMetricsRegistryForTests();
    const tenantId = "00000000-0000-4000-8000-000000000099";
    const bookingPayments = new BookingPaymentAdapter();
    const repo = new InMemoryFinanceRepository(bookingPayments);
    repo.recordPrepaymentBookingSyncDegraded = async () => {
      throw new Error("forced-persist-failure");
    };
    const service = new FinanceService(
      new DenaliFinanceLedgerPolicyAdapter(),
      repo,
      bookingPayments,
      new DenaliFinanceReceiptDefaultsAdapter(),
      new BookingRegistrationDisplayAdapter()
    );
    const persist = (
      service as unknown as {
        persistBookingSyncDegradedWithRetries: (input: {
          readonly tenantId: string;
          readonly registrationId: string;
          readonly paymentStatus: string;
          readonly error: string;
          readonly prepaymentDomainEventId: string;
        }) => Promise<void>;
      }
    ).persistBookingSyncDegradedWithRetries.bind(service);

    await persist({
      tenantId,
      registrationId: "00000000-0000-4000-8000-000000000098",
      paymentStatus: "partial",
      error: "FINANCE_BOOKING_PAYMENT_SYNC_MISS",
      prepaymentDomainEventId: "prepayment:test:key",
    });

    assert.equal(
      metricsRegistry.getMetric("finance_prepayment_booking_sync_degraded_persist_failed_total", {
        tenant_id: tenantId,
      }),
      1
    );
  });
});
