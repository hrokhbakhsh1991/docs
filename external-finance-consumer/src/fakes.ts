/**
 * External-consumer host + workspace fakes — public package types only.
 */
import type {
  BuildPaymentCaptureJournalInput,
  BuildPrepaymentJournalInput,
  FinanceActorContext,
  FinanceAuthorizationPort,
  FinanceCapabilityPort,
  FinanceClockPort,
  FinanceLedgerCapturePlan,
  FinanceLedgerPolicyPort,
  FinanceLoggerPort,
  FinanceMetricsPort,
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
  FinanceSchedulePort,
  FinanceStorageDriverPort,
  IBookingPaymentPort,
  PaymentScheduleItem,
  ReceiptProofStoragePort,
  RegistrationDisplayPort,
} from "@app-tour/finance-core";

export const ExternalClock: FinanceClockPort = {
  nowIso: () => "2026-07-19T00:00:00.000Z",
};

export const ExternalLogger: FinanceLoggerPort = {
  warn() {},
  error() {},
};

export const ExternalMetrics: FinanceMetricsPort = {
  increment() {},
};

/** Durable mode — FinanceService attaches ledgerCapture on approve. */
export const ExternalStorage: FinanceStorageDriverPort = {
  isDurablePersistence: () => true,
  isDatabaseConfigured: () => true,
};

export const ExternalReceiptDefaults: FinanceReceiptDefaultsPort = {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return { amountMinor: "1000000", currency: "IRR" };
  },
};

export const ExternalDisplay: RegistrationDisplayPort = {
  async getByRegistrationIds() {
    return new Map();
  },
  async listRegistrationIdsByTourId() {
    return [];
  },
};

export const ExternalCapability: FinanceCapabilityPort = {
  async assertEnabled() {
    return { workspaceType: "external-finance-consumer", theme: {} };
  },
};

export const ExternalAuthz: FinanceAuthorizationPort = {
  assertOperatorAccess(_auth: FinanceActorContext) {},
  assertReceiptSubmitAccess(_auth: FinanceActorContext) {},
};

export const ExternalSchedules: FinanceSchedulePort = {
  async listAllSchedules() {
    return [];
  },
  async getSchedule() {
    return [];
  },
  async putSchedule(_tenantId, _registrationId, items: readonly PaymentScheduleItem[]) {
    return [...items];
  },
};

export const ExternalProof: ReceiptProofStoragePort = {
  async getSignedReadUrl() {
    return "https://external-consumer.test/proof";
  },
};

export type ExternalLedgerProbe = FinanceLedgerPolicyPort & {
  readonly paymentCaptures: BuildPaymentCaptureJournalInput[];
  readonly prepaymentCaptures: BuildPrepaymentJournalInput[];
};

export function createExternalLedgerPolicy(): ExternalLedgerProbe {
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
            account: "ext:cash",
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
            account: "ext:revenue",
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
            account: "ext:cash",
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
            account: "ext:liability",
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

export function createExternalBookingPort(): IBookingPaymentPort & {
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
