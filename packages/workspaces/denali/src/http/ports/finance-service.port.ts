import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type {
  CreateManualPaymentBody,
  GenerateScheduleBody,
  RecordPrepaymentBody,
  ReviewReceiptBody,
  SubmitReceiptBody,
} from "../schemas/finance-request.schemas";

/** Finance domain port — implemented by API `FinanceService` (Prisma adapters stay in host). */
export type FinanceServicePort = {
  readonly getSummary: (auth: TenantAuthContext) => Promise<unknown>;
  readonly listOpenPayments: (auth: TenantAuthContext, limit: number) => Promise<readonly unknown[]>;
  readonly listLedgerEvents: (auth: TenantAuthContext, limit: number) => Promise<readonly unknown[]>;
  readonly listPayments: (auth: TenantAuthContext, limit: number) => Promise<readonly unknown[]>;
  readonly createManualPayment: (
    auth: TenantAuthContext,
    body: CreateManualPaymentBody
  ) => Promise<unknown>;
  readonly submitReceipt: (auth: TenantAuthContext, body: SubmitReceiptBody) => Promise<unknown>;
  readonly reviewReceipt: (
    auth: TenantAuthContext,
    receiptId: string,
    body: ReviewReceiptBody
  ) => Promise<unknown>;
  readonly getReceiptUrl: (auth: TenantAuthContext, receiptId: string) => Promise<unknown>;
  readonly listPendingReceipts: (
    auth: TenantAuthContext,
    limit: number
  ) => Promise<readonly unknown[]>;
  readonly listPrepayments: (auth: TenantAuthContext, limit: number) => Promise<readonly unknown[]>;
  readonly recordPrepayment: (
    auth: TenantAuthContext,
    body: RecordPrepaymentBody
  ) => Promise<unknown>;
  readonly listPaymentSchedules: (auth: TenantAuthContext) => Promise<readonly unknown[]>;
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
