/**
 * PREPAY-SYNC-DEG-PERSIST-02 — permanent degraded persist failure is observable.
 * Uses fake host ports only (no Denali / metrics registry / storage-driver).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FinanceService } from "./finance.service.ts";
import {
  createRecordingMetrics,
  fakeDurablePersistenceMode,
  fakeEmptySchedules,
  fakeFixedClock,
  fakeNoopLog,
  fakeNullObligation,
  fakePermissiveCapability,
  fakePermissiveAccess,
  fakeReceiptProofUrl,
} from "./finance-service-host-fakes.ts";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository.ts";
import type { IBookingPaymentPort } from "./ports/booking-payment.port.ts";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port.ts";
import type { FinanceReceiptDefaultsPort } from "./ports/finance-receipt-defaults.port.ts";
import type { RegistrationDisplayPort } from "./ports/registration-display.port.ts";

const stubLedgerPolicy: FinanceLedgerPolicyPort = {
  buildPaymentCaptureJournal: () => ({
    journalId: "journal-stub",
    domainEventId: "domain-stub",
    lines: [],
  }),
  buildPrepaymentJournal: () => ({
    journalId: "journal-stub",
    domainEventId: "domain-stub",
    lines: [],
  }),
};

const stubReceiptDefaults: FinanceReceiptDefaultsPort = {
  offlineReceiptPaymentDefaults: () => ({ amountMinor: "1", currency: "IRR" }),
};

const stubBookingPayments: IBookingPaymentPort = {
  syncStatus: async () => null,
  raisePaidInTx: async () => "paid",
  memberOwnsRegistration: async () => false,
  getPaymentStatus: async () => null,
  getRegistrationLifecycleStatus: async () => null,
};

const stubRegistrationDisplay: RegistrationDisplayPort = {
  getByRegistrationIds: async () => new Map(),
  listRegistrationIdsByTourId: async () => [],
};

describe("finance booking-sync degraded persist", { concurrency: false }, () => {
  it("PREPAY-SYNC-DEG-PERSIST-02 permanent failure increments metric + does not throw", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000099";
    const repo = new InMemoryFinanceRepository(stubBookingPayments);
    repo.recordPrepaymentBookingSyncDegraded = async () => {
      throw new Error("forced-persist-failure");
    };
    const metrics = createRecordingMetrics();
    const service = new FinanceService(
      stubLedgerPolicy,
      repo,
      stubBookingPayments,
      stubReceiptDefaults,
      stubRegistrationDisplay,
      metrics,
      fakeDurablePersistenceMode,
      fakeReceiptProofUrl,
      fakePermissiveCapability,
      fakePermissiveAccess,
      fakeEmptySchedules,
      fakeNoopLog,
      fakeFixedClock,
      fakeNullObligation
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

    assert.equal(metrics.increments.length, 1);
    assert.deepEqual(metrics.increments[0], {
      name: "finance_prepayment_booking_sync_degraded_persist_failed_total",
      labels: { tenant_id: tenantId },
      amount: 1,
    });
  });
});
