import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type {
  CreateManualPaymentBody,
  GenerateScheduleBody,
  RecordPrepaymentBody,
  ReviewReceiptBody,
  SubmitReceiptBody,
} from "@app-tour/finance-http-contracts";

/** Finance domain port — implemented by API `FinanceService` (Prisma adapters stay in host). */
export type FinanceServicePort = {
  readonly getSummary: (auth: TenantAuthContext) => Promise<unknown>;
  readonly listOpenPayments: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string
  ) => Promise<readonly unknown[]>;
  readonly listLedgerEvents: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string
  ) => Promise<readonly unknown[]>;
  readonly listPayments: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string
  ) => Promise<readonly unknown[]>;
  readonly createManualPayment: (
    auth: TenantAuthContext,
    body: CreateManualPaymentBody,
    idempotencyKey: string
  ) => Promise<unknown>;
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
    registrationId?: string
  ) => Promise<readonly unknown[]>;
  readonly listPrepayments: (
    auth: TenantAuthContext,
    limit: number,
    registrationId?: string
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
    registrationId?: string
  ) => Promise<readonly unknown[]>;
  readonly getPaymentSchedule: (
    auth: TenantAuthContext,
    registrationId: string
  ) => Promise<readonly unknown[]>;
  readonly generatePaymentSchedule: (
    auth: TenantAuthContext,
    body: GenerateScheduleBody
  ) => Promise<unknown>;
  readonly getRegistrationInvoice: (
    auth: TenantAuthContext,
    registrationId: string
  ) => Promise<unknown>;
};
