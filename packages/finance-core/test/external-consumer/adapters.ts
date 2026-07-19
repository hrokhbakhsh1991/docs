/**
 * Second-application adapters — import ONLY from @app-tour/finance-core public surface.
 * Simulates another repository wiring host ports; must not import apps/api, Prisma, or finance-core/src.
 */
import { randomUUID } from "node:crypto";

import type {
  CreatePaymentInput,
  FinanceActorContext,
  FinanceAuthorizationPort,
  FinanceCapabilityPort,
  FinanceClockPort,
  FinanceLedgerPolicyPort,
  FinanceLoggerPort,
  FinanceMetricsPort,
  FinancePaymentRow,
  FinanceRepositoryPort,
  FinanceSchedulePort,
  FinanceStorageDriverPort,
  FinanceReceiptDefaultsPort,
  IBookingPaymentPort,
  ReceiptProofStoragePort,
  RegistrationDisplayPort,
} from "@app-tour/finance-core";

export const ExternalClock: FinanceClockPort = {
  nowIso: () => "2026-07-19T12:00:00.000Z",
};

export const ExternalLogger: FinanceLoggerPort = {
  warn() {},
  error() {},
};

export const ExternalMetrics: FinanceMetricsPort = {
  increment() {},
};

export const ExternalStorage: FinanceStorageDriverPort = {
  isDurablePersistence: () => true,
  isDatabaseConfigured: () => true,
};

export const ExternalReceiptDefaults: FinanceReceiptDefaultsPort = {
  offlineReceiptPaymentDefaults: () => ({ amountMinor: "1000000", currency: "IRR" }),
};

export const ExternalDisplay: RegistrationDisplayPort = {
  async getByRegistrationIds() {
    return new Map();
  },
};

export const ExternalCapability: FinanceCapabilityPort = {
  async assertEnabled() {
    return { workspaceType: "external-consumer", theme: {} };
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
  async putSchedule(_tenantId, _registrationId, items) {
    return [...items];
  },
};

export const ExternalProof: ReceiptProofStoragePort = {
  async getSignedReadUrl() {
    return "https://external.test/proof";
  },
};

export function createExternalLedgerPolicy(): FinanceLedgerPolicyPort {
  return {
    buildPaymentCaptureJournal(input) {
      return {
        journalId: `journal:payment:${input.paymentId}`,
        domainEventId: `payment:${input.paymentId}:ledger-capture-anchor`,
        lines: [],
      };
    },
    buildPrepaymentJournal(input) {
      return {
        journalId: `journal:prepay:${input.journalSeed}`,
        domainEventId: input.ledgerDomainEventId,
        lines: [],
      };
    },
  };
}

export function createExternalBookingPort(): IBookingPaymentPort {
  return {
    async syncStatus(input) {
      return input.paymentStatus;
    },
    async raisePaidInTx(_tx, input) {
      return "paid";
    },
    async memberOwnsRegistration() {
      return true;
    },
    async getPaymentStatus() {
      return "unpaid";
    },
  };
}

/**
 * Minimal second-app repository — only the create-manual-payment path is exercised.
 * Other methods throw to prove the consumer does not accidentally call host infrastructure.
 */
export function createExternalRepository(): FinanceRepositoryPort {
  const payments = new Map<string, FinancePaymentRow & { tenantId: string; creationIdempotencyKey?: string }>();

  function notImplemented(name: string): never {
    throw new Error(`external-consumer stub: ${name} not implemented`);
  }

  return {
    async getSummary() {
      return {
        pendingManualPayments: 0,
        pendingReceiptReviews: 0,
        paidPayments: 0,
        failedPayments: 0,
      };
    },
    async listOpenPayments() {
      return [];
    },
    async listPayments() {
      return [];
    },
    async listLedgerEvents() {
      return [];
    },
    async findPaymentStatusesByRegistration(tenantId, registrationId) {
      return [...payments.values()]
        .filter((p) => p.tenantId === tenantId && p.registrationId === registrationId)
        .map((p) => p.status);
    },
    async createManualPayment(input: CreatePaymentInput): Promise<FinancePaymentRow> {
      const row: FinancePaymentRow & { tenantId: string; creationIdempotencyKey?: string } = {
        id: randomUUID(),
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        method: input.method,
        provider: input.provider,
        status: input.status,
        createdAt: new Date("2026-07-19T12:00:00.000Z"),
        paidAt: null,
        creationIdempotencyKey: input.creationIdempotencyKey,
      };
      payments.set(row.id, row);
      return row;
    },
    async findPaymentById(tenantId, paymentId) {
      const row = payments.get(paymentId);
      if (!row || row.tenantId !== tenantId) return null;
      return row;
    },
    async findPaymentByCreationIdempotencyKey(tenantId, creationIdempotencyKey) {
      for (const row of payments.values()) {
        if (row.tenantId === tenantId && row.creationIdempotencyKey === creationIdempotencyKey) {
          return row;
        }
      }
      return null;
    },
    async findFirstPendingManualPayment() {
      return null;
    },
    async findLatestReceiptForRegistration() {
      return null;
    },
    async createReceipt() {
      return notImplemented("createReceipt");
    },
    async findReceiptById() {
      return null;
    },
    async listPendingReceipts() {
      return [];
    },
    async updateReceiptReview() {
      return notImplemented("updateReceiptReview");
    },
    async approveManualReceiptAtomic() {
      return notImplemented("approveManualReceiptAtomic");
    },
    async listPrepayments() {
      return [];
    },
    async recordPrepaymentAtomic() {
      return notImplemented("recordPrepaymentAtomic");
    },
    async recordPrepaymentBookingSyncDegraded() {},
    async listOpenPrepaymentBookingSyncDegraded() {
      return [];
    },
    async markPrepaymentBookingSyncRecovered() {},
    async getRegistrationInvoiceFacts() {
      return notImplemented("getRegistrationInvoiceFacts");
    },
  };
}
