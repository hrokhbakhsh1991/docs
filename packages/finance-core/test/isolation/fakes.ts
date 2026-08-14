/**
 * Isolation fakes for finance-core extraction simulation — no apps/api.
 */
import type { IBookingPaymentPort } from "../../src/ports/booking-payment.port.ts";
import type { FinanceAuthorizationPort } from "../../src/ports/finance-access.port.ts";
import type { FinanceCapabilityPort } from "../../src/ports/finance-capability.port.ts";
import type { FinanceActorContext } from "../../src/ports/finance-actor-context.ts";
import type { FinanceClockPort } from "../../src/ports/finance-clock.port.ts";
import type {
  BuildPaymentCaptureJournalInput,
  BuildPrepaymentJournalInput,
  FinanceLedgerCapturePlan,
  FinanceLedgerPolicyPort,
} from "../../src/ports/finance-ledger-policy.port.ts";
import type { FinanceLoggerPort } from "../../src/ports/finance-log.port.ts";
import type { FinanceMetricsPort } from "../../src/ports/finance-metrics.port.ts";
import type { FinanceStorageDriverPort } from "../../src/ports/finance-persistence-mode.port.ts";
import type { FinanceReceiptDefaultsPort } from "../../src/ports/finance-receipt-defaults.port.ts";
import type { ReceiptProofStoragePort } from "../../src/ports/finance-receipt-proof-url.port.ts";
import type { FinanceSchedulePort } from "../../src/ports/finance-schedule.port.ts";
import type { PaymentScheduleItem } from "../../src/domain/schedule.ts";
import type { RegistrationDisplayPort } from "../../src/ports/registration-display.port.ts";

export const FakeClock: FinanceClockPort = {
  nowIso: () => "2026-07-19T00:00:00.000Z",
};

export const FakeLogger: FinanceLoggerPort = {
  warn() {},
  error() {},
};

export const FakeMetrics: FinanceMetricsPort = {
  increment() {},
};

/** Durable path so FinanceService attaches ledgerCapture on approve. */
export const FakeStorage: FinanceStorageDriverPort = {
  isDurablePersistence: () => true,
  isDatabaseConfigured: () => true,
};

export const FakeStorageMemoryMode: FinanceStorageDriverPort = {
  isDurablePersistence: () => false,
  isDatabaseConfigured: () => true,
};

export type LedgerPolicyProbe = FinanceLedgerPolicyPort & {
  readonly paymentCaptures: BuildPaymentCaptureJournalInput[];
  readonly prepaymentCaptures: BuildPrepaymentJournalInput[];
};

export function createFakeLedgerPolicy(): LedgerPolicyProbe {
  const paymentCaptures: BuildPaymentCaptureJournalInput[] = [];
  const prepaymentCaptures: BuildPrepaymentJournalInput[] = [];
  return {
    paymentCaptures,
    prepaymentCaptures,
    buildPaymentCaptureJournal(input): FinanceLedgerCapturePlan {
      paymentCaptures.push(input);
      return {
        journalId: `journal:payment:${input.paymentId}`,
        domainEventId: `payment:${input.paymentId}:ledger-capture-anchor`,
        lines: [
          {
            id: `line:${input.paymentId}:dr`,
            journalId: `journal:payment:${input.paymentId}`,
            tenantId: input.tenantId,
            account: "cash",
            side: "debit",
            amount_minor: input.amountMinor,
            currency: input.currency,
            correlationId: input.paymentId,
            idempotencyKey: `payment:${input.paymentId}:ledger-capture-anchor`,
            createdAt: input.capturedAtIso,
          },
          {
            id: `line:${input.paymentId}:cr`,
            journalId: `journal:payment:${input.paymentId}`,
            tenantId: input.tenantId,
            account: "revenue",
            side: "credit",
            amount_minor: input.amountMinor,
            currency: input.currency,
            correlationId: input.paymentId,
            idempotencyKey: `payment:${input.paymentId}:ledger-capture-anchor:cr`,
            createdAt: input.capturedAtIso,
          },
        ],
      };
    },
    buildPrepaymentJournal(input): FinanceLedgerCapturePlan {
      prepaymentCaptures.push(input);
      return {
        journalId: `journal:prepay:${input.journalSeed}`,
        domainEventId: input.ledgerDomainEventId,
        lines: [
          {
            id: `line:prepay:${input.journalSeed}:dr`,
            journalId: `journal:prepay:${input.journalSeed}`,
            tenantId: input.tenantId,
            account: "cash",
            side: "debit",
            amount_minor: input.amountMinor,
            currency: input.currency,
            correlationId: input.registrationId,
            idempotencyKey: input.ledgerDomainEventId,
            createdAt: input.recordedAtIso,
          },
          {
            id: `line:prepay:${input.journalSeed}:cr`,
            journalId: `journal:prepay:${input.journalSeed}`,
            tenantId: input.tenantId,
            account: "liability",
            side: "credit",
            amount_minor: input.amountMinor,
            currency: input.currency,
            correlationId: input.registrationId,
            idempotencyKey: `${input.ledgerDomainEventId}:cr`,
            createdAt: input.recordedAtIso,
          },
        ],
      };
    },
  };
}

export function createFakeBookingPort(): IBookingPaymentPort & {
  readonly paidRegistrations: Set<string>;
} {
  const paidRegistrations = new Set<string>();
  return {
    paidRegistrations,
    async syncStatus(input) {
      if (input.paymentStatus === "paid") {
        paidRegistrations.add(input.registrationId);
      }
      return input.paymentStatus;
    },
    async raisePaidInTx(_tx, input) {
      if (input.paymentStatus === "paid" || input.paymentStatus === "partial") {
        paidRegistrations.add(input.registrationId);
      }
      return input.paymentStatus;
    },
    async memberOwnsRegistration() {
      return true;
    },
    async getPaymentStatus(input) {
      return paidRegistrations.has(input.registrationId) ? "paid" : "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
}

export const FakeReceiptDefaults: FinanceReceiptDefaultsPort = {
  offlineReceiptPaymentDefaults: () => ({ amountMinor: "1000000", currency: "IRR" }),
};

export const FakeDisplay: RegistrationDisplayPort = {
  async getByRegistrationIds() {
    return new Map();
  },
  async listRegistrationIdsByTourId() {
    return [];
  },
}

export const FakeCapability: FinanceCapabilityPort = {
  async assertEnabled() {
    return { workspaceType: "isolation", theme: {} };
  },
};

export const FakeAuthz: FinanceAuthorizationPort = {
  assertOperatorAccess(_auth: FinanceActorContext) {},
  assertReceiptSubmitAccess(_auth: FinanceActorContext) {},
};

export const FakeSchedules: FinanceSchedulePort = {
  async listAllSchedules() {
    return [];
  },
  async getSchedule() {
    return [];
  },
  async putSchedule(_tenantId, _registrationId, items: readonly PaymentScheduleItem[]) {
    return items;
  },
};

export const FakeProof: ReceiptProofStoragePort = {
  async getSignedReadUrl() {
    return "https://example.test/proof";
  },
};
