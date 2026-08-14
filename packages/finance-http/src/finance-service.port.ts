import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type {
  CancelPendingManualPaymentBody,
  CreateManualPaymentBody,
  GenerateScheduleBody,
  RecordPrepaymentBody,
  ReviewReceiptBody,
  SubmitReceiptBody,
} from "@app-tour/finance-http-contracts";

/** Finance domain port — implemented by API `FinanceService` (Prisma adapters stay in host). */
export type FinanceServicePort = {
  readonly getSummary: (auth: TenantAuthContext) => Promise<unknown>;
  readonly getReportByTour: (
    auth: TenantAuthContext,
    tourId?: string
  ) => Promise<unknown>;
  readonly listOpenPayments: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) => Promise<readonly unknown[]>;
  readonly listLedgerEvents: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) => Promise<readonly unknown[]>;
  readonly listPayments: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) => Promise<readonly unknown[]>;
  readonly createManualPayment: (
    auth: TenantAuthContext,
    body: CreateManualPaymentBody,
    idempotencyKey: string
  ) => Promise<unknown>;
  readonly cancelPendingManualPayment: (
    auth: TenantAuthContext,
    body: {
      readonly paymentId: string;
      readonly reasonCode: CancelPendingManualPaymentBody["reasonCode"];
      readonly reasonNote?: string | null;
    },
    idempotencyKey?: string
  ) => Promise<{
    readonly id: string;
    readonly status: string;
    readonly domainEventId: string;
    readonly replay: boolean;
    readonly audit: {
      readonly occurredAt: string;
      readonly reasonCode: string;
    };
  }>;
  readonly submitReceipt: (
    auth: TenantAuthContext,
    body: SubmitReceiptBody,
    idempotencyKey?: string
  ) => Promise<unknown>;
  readonly reviewReceipt: (
    auth: TenantAuthContext,
    receiptId: string,
    body: ReviewReceiptBody
  ) => Promise<Record<string, unknown>>;
  readonly getReceiptUrl: (auth: TenantAuthContext, receiptId: string) => Promise<unknown>;
  readonly listPendingReceipts: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string,
    tourId?: string,
    cursor?: string | null
  ) => Promise<{
    readonly items: readonly unknown[];
    readonly nextCursor: string | null;
    readonly hasMore: boolean;
  }>;
  /** PR23-C2 — read-only operator finance exceptions. */
  readonly listOperatorFinanceExceptions: (
    auth: TenantAuthContext,
    query?: { readonly limit?: number; readonly cursor?: string | null }
  ) => Promise<{
    readonly items: readonly unknown[];
    readonly nextCursor: string | null;
    readonly hasMore: boolean;
  }>;
  /** PR23-D1 — outstanding AR balances (invoice SoT). */
  readonly listOutstandingBalances: (
    auth: TenantAuthContext,
    query?: {
      readonly limit?: number;
      readonly cursor?: string | null;
      readonly tourId?: string;
    }
  ) => Promise<{
    readonly items: readonly unknown[];
    readonly nextCursor: string | null;
    readonly hasMore: boolean;
  }>;
  /** PR23-D2 — tour AR rollup from outstanding invoices. */
  readonly listTourCollectionSummary: (
    auth: TenantAuthContext,
    query?: {
      readonly limit?: number;
      readonly cursor?: string | null;
      readonly tourId?: string;
    }
  ) => Promise<{
    readonly items: readonly unknown[];
    readonly nextCursor: string | null;
    readonly hasMore: boolean;
  }>;
  /** PR23-E3 — operator refund list (enriched). */
  readonly listOperatorRefunds: (
    auth: TenantAuthContext,
    query?: {
      readonly limit?: number;
      readonly cursor?: string | null;
      readonly registrationId?: string;
      readonly status?: string;
    }
  ) => Promise<{
    readonly items: readonly unknown[];
    readonly nextCursor: string | null;
    readonly hasMore: boolean;
  }>;
  /** PR23-E3 — single enriched refund. */
  readonly getOperatorRefund: (
    auth: TenantAuthContext,
    refundId: string
  ) => Promise<unknown>;
  readonly requestRefund: (
    auth: TenantAuthContext,
    body: import("@app-tour/finance-http-contracts").RequestRefundBody & {
      readonly idempotencyKey?: string;
    }
  ) => Promise<Record<string, unknown>>;
  readonly approveRefund: (
    auth: TenantAuthContext,
    refundId: string
  ) => Promise<Record<string, unknown>>;
  readonly completeRefund: (
    auth: TenantAuthContext,
    refundId: string,
    body?: { readonly completionNote?: string | null }
  ) => Promise<Record<string, unknown>>;
  readonly rejectRefund: (
    auth: TenantAuthContext,
    refundId: string,
    body?: { readonly rejectNote?: string | null }
  ) => Promise<Record<string, unknown>>;
  readonly cancelRefund: (
    auth: TenantAuthContext,
    refundId: string
  ) => Promise<Record<string, unknown>>;
  readonly listPrepayments: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) => Promise<readonly unknown[]>;
  readonly recordPrepayment: (
    auth: TenantAuthContext,
    body: RecordPrepaymentBody,
    idempotencyKey: string
  ) => Promise<Record<string, unknown>>;
  readonly listPrepaymentBookingSyncDegraded: (
    auth: TenantAuthContext,
    limit: number
  ) => Promise<readonly unknown[]>;
  readonly retryPrepaymentBookingSync: (
    auth: TenantAuthContext,
    registrationId: string
  ) => Promise<Record<string, unknown>>;
  readonly listPaymentSchedules: (
    auth: TenantAuthContext,
    registrationId?: string,
    tourId?: string
  ) => Promise<readonly unknown[]>;
  readonly getPaymentSchedule: (
    auth: TenantAuthContext,
    registrationId: string
  ) => Promise<readonly unknown[]>;
  readonly generatePaymentSchedule: (
    auth: TenantAuthContext,
    body: GenerateScheduleBody
  ) => Promise<unknown>;
  readonly patchPaymentScheduleItem: (
    auth: TenantAuthContext,
    registrationId: string,
    itemId: string,
    body: import("@app-tour/finance-http-contracts").PatchScheduleItemBody
  ) => Promise<{
    readonly registrationId: string;
    readonly item: { readonly id: string };
    readonly audit: {
      readonly eventType: "finance.schedule.item_waived";
      readonly reason: string;
      readonly actorUserId: string;
    } | null;
  }>;
  readonly getRegistrationInvoice: (
    auth: TenantAuthContext,
    registrationId: string
  ) => Promise<unknown>;
  readonly setRegistrationObligationOverride: (
    auth: TenantAuthContext,
    input: {
      readonly registrationId: string;
      readonly obligationMinor: string;
      readonly reason?: string;
    }
  ) => Promise<unknown>;
};
