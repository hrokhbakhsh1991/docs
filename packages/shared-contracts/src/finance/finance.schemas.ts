/**
 * Finance wire contracts — Zod schema library (Phase 1).
 *
 * Import `z` from this module (not directly from `"zod"`) so API, web, and ledger
 * code share the same Zod major version via `@repo/shared-contracts`.
 *
 * Aligns with persisted rows:
 * - `apps/api/src/modules/payments/entities/payment.entity.ts`
 * - `apps/api/src/modules/payments/entities/payment-receipt.entity.ts`
 */

import { z } from "zod";

/** Shared Zod instance for all finance contract schemas in this package. */
export { z };

// --- Primitives (wire / API) -------------------------------------------------

/** UUID v4 string (tenant-scoped entity ids). */
export const FinanceUuidSchema = z.uuid();

/**
 * Positive integer amount in minor units (matches `payments.amount` numeric column
 * and ledger `amount_minor` conventions — no fractional minor units).
 */
export const MinorUnitAmountStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "amount must be a non-negative integer minor-unit string")
  .refine((value) => {
    try {
      return BigInt(value) > 0n;
    } catch {
      return false;
    }
  }, "amount must be greater than zero");

/** ISO 4217-style currency code (`payments.currency` / `payment_receipts` context: varchar 8). */
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .min(3, "currency must be at least 3 characters")
  .max(8, "currency must be at most 8 characters")
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}([A-Z0-9]{0,5})?$/.test(value), "invalid currency code format");

/** Timestamptz serialized for JSON APIs (ISO-8601). */
export const IsoDateTimeStringSchema = z.string().datetime({ offset: true });

export const NullableIsoDateTimeStringSchema = IsoDateTimeStringSchema.nullable();

// --- Payment status (single source of truth) ---------------------------------

/**
 * Persisted `payments.status` / `payment_status_enum` values.
 * Replaces duplicate enums in `payment.entity.ts` and legacy `finance/payments/domain/payment-status.ts`
 * (lowercase `initiated` / `authorized` / … lives on {@link PaymentAttemptStatus} in API finance domain only).
 */
export const PAYMENT_STATUS_VALUES = [
  "Pending",
  "Paid",
  "Failed",
  "Refunded",
  "Cancelled",
] as const;

export const PaymentStatusSchema = z.enum(PAYMENT_STATUS_VALUES);

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/** Runtime labels for Nest, TypeORM, and services (use instead of a local duplicate enum). */
export const PaymentStatus = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
} as const satisfies Record<string, PaymentStatus>;

/**
 * Allowed **single-step** transitions for persisted `payments.status`.
 * Idempotent `from === to` is always permitted (see {@link isAllowedPaymentStatusTransition}).
 *
 * Aligns with `assertAllowedPaymentStatusTransition` in `apps/api` (formerly intent-lifecycle mapped).
 */
export const PAYMENT_STATUS_TRANSITIONS = {
  Pending: ["Paid", "Failed"],
  Paid: ["Refunded", "Cancelled"],
  Failed: [],
  Refunded: [],
  Cancelled: [],
} as const satisfies Record<PaymentStatus, readonly PaymentStatus[]>;

/** Directed edges `(from → to)` derived from {@link PAYMENT_STATUS_TRANSITIONS}. */
export const PAYMENT_STATUS_TRANSITION_EDGES = [
  ["Pending", "Paid"],
  ["Pending", "Failed"],
  ["Paid", "Refunded"],
  ["Paid", "Cancelled"],
] as const satisfies ReadonlyArray<readonly [PaymentStatus, PaymentStatus]>;

export function isAllowedPaymentStatusTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  if (from === to) {
    return true;
  }
  const allowedNext = PAYMENT_STATUS_TRANSITIONS[from] as readonly PaymentStatus[];
  return allowedNext.includes(to);
}

export function allowedPaymentStatusNextStates(
  from: PaymentStatus,
): readonly PaymentStatus[] {
  return PAYMENT_STATUS_TRANSITIONS[from];
}

/** Mirrors `PaymentMethod` on `PaymentEntity` / `payment_method_enum`. */
export const PaymentMethodSchema = z.enum(["Online", "Manual"]);

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/** Mirrors `ReceiptStatus` on `PaymentReceiptEntity` / `receipt_status_enum`. */
export const ReceiptStatusSchema = z.enum(["Pending", "Approved", "Rejected"]);

export type ReceiptStatus = z.infer<typeof ReceiptStatusSchema>;

// --- Core domain rows ----------------------------------------------------------

/**
 * Persisted payment row (`payments` table / `PaymentEntity`).
 * Product language may say "payment intent"; this is the stored payment aggregate, not a PSP SDK object.
 */
export const PaymentIntentSchema = z.object({
  id: FinanceUuidSchema,
  tenantId: FinanceUuidSchema,
  registrationId: FinanceUuidSchema,
  amount: MinorUnitAmountStringSchema,
  currency: CurrencyCodeSchema,
  method: PaymentMethodSchema,
  provider: z.string().trim().min(1).max(64),
  providerPaymentId: z.string().trim().min(1).max(128).nullable(),
  status: PaymentStatusSchema,
  paidAt: NullableIsoDateTimeStringSchema,
  failedAt: NullableIsoDateTimeStringSchema,
  refundedAt: NullableIsoDateTimeStringSchema,
  ledgerJournalId: FinanceUuidSchema.nullable(),
  createdAt: IsoDateTimeStringSchema,
  updatedAt: IsoDateTimeStringSchema,
  deletedAt: NullableIsoDateTimeStringSchema.optional(),
});

export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

/** Manual payment proof upload (`payment_receipts` table / `PaymentReceiptEntity`). */
export const PaymentReceiptSchema = z.object({
  id: FinanceUuidSchema,
  tenantId: FinanceUuidSchema,
  paymentId: FinanceUuidSchema,
  fileKey: z.string().trim().min(1).max(1024),
  status: ReceiptStatusSchema,
  note: z.string().nullable(),
  reviewedByUserId: FinanceUuidSchema.nullable(),
  reviewedAt: NullableIsoDateTimeStringSchema,
  reviewNote: z.string().nullable(),
  ledgerJournalId: FinanceUuidSchema.nullable(),
  createdAt: IsoDateTimeStringSchema,
  updatedAt: IsoDateTimeStringSchema,
  deletedAt: NullableIsoDateTimeStringSchema.optional(),
});

export type PaymentReceipt = z.infer<typeof PaymentReceiptSchema>;

// --- Ledger accounts (Phase 1.2) ------------------------------------------------

/**
 * Known synthetic GL accounts (`apps/api/.../ledger/ledger-accounts.ts`).
 * Dynamic accounts use `booking:{registrationId}`, `member:{userId}`, or extension `gl:…` codes.
 */
export const LEDGER_ACCOUNTS = {
  REGISTRATION_LEADER_PAYMENT_CLEARING: "gl:leader-registration-payment-clearing",
  DISCOUNT_ADJUSTMENTS: "gl:discount-adjustments",
} as const;

export type LedgerGlAccountId = (typeof LEDGER_ACCOUNTS)[keyof typeof LEDGER_ACCOUNTS];

/** @deprecated Prefer {@link LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING}. */
export const REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT =
  LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING;

/** @deprecated Prefer {@link LEDGER_ACCOUNTS.DISCOUNT_ADJUSTMENTS}. */
export const DISCOUNT_ADJUSTMENTS_ACCOUNT = LEDGER_ACCOUNTS.DISCOUNT_ADJUSTMENTS;

export const LEDGER_GL_ACCOUNT_VALUES = Object.values(LEDGER_ACCOUNTS) as LedgerGlAccountId[];

const LEDGER_BOOKING_ACCOUNT_PREFIX = "booking:";
const LEDGER_MEMBER_ACCOUNT_PREFIX = "member:";
const LEDGER_GL_ACCOUNT_PREFIX = "gl:";

export function bookingLedgerAccountId(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new Error("bookingLedgerAccountId: registrationId is required");
  }
  return `${LEDGER_BOOKING_ACCOUNT_PREFIX}${id}`;
}

export function memberLedgerAccountId(userId: string): string {
  const id = userId.trim();
  if (!id) {
    throw new Error("memberLedgerAccountId: userId is required");
  }
  return `${LEDGER_MEMBER_ACCOUNT_PREFIX}${id}`;
}

export function isLedgerGlAccountId(accountId: string): accountId is LedgerGlAccountId {
  return (LEDGER_GL_ACCOUNT_VALUES as readonly string[]).includes(accountId);
}

/**
 * Validates ledger account codes used on {@link LedgerJournalLine} / `ledger_journal_lines.account`.
 * Accepts {@link LEDGER_ACCOUNTS} GL codes, `booking:{uuid}`, `member:{uuid}`, and extension `gl:…` paths.
 */
export const LedgerAccountIdSchema = z
  .string()
  .trim()
  .min(1, "accountId is required")
  .max(128, "accountId must be at most 128 characters")
  .refine((accountId) => {
    if (isLedgerGlAccountId(accountId)) {
      return true;
    }
    if (accountId.startsWith(LEDGER_BOOKING_ACCOUNT_PREFIX)) {
      return FinanceUuidSchema.safeParse(
        accountId.slice(LEDGER_BOOKING_ACCOUNT_PREFIX.length),
      ).success;
    }
    if (accountId.startsWith(LEDGER_MEMBER_ACCOUNT_PREFIX)) {
      return FinanceUuidSchema.safeParse(accountId.slice(LEDGER_MEMBER_ACCOUNT_PREFIX.length))
        .success;
    }
    if (accountId.startsWith(LEDGER_GL_ACCOUNT_PREFIX)) {
      return accountId.length > LEDGER_GL_ACCOUNT_PREFIX.length;
    }
    return false;
  }, "accountId must match LEDGER_ACCOUNTS, booking:{uuid}, member:{uuid}, or gl:…");

export type LedgerAccountId = z.infer<typeof LedgerAccountIdSchema>;

export const LedgerPostingSideSchema = z.enum(["debit", "credit"]);

export type LedgerPostingSide = z.infer<typeof LedgerPostingSideSchema>;

/**
 * One immutable ledger line (wire contract for `LedgerJournalLine` / `ledger_journal_lines`).
 * Persisted column `account` maps to `accountId`; `amount_minor` maps to `amountMinor`.
 */
export const LedgerEntrySchema = z.object({
  id: FinanceUuidSchema,
  journalId: FinanceUuidSchema,
  tenantId: FinanceUuidSchema,
  accountId: LedgerAccountIdSchema,
  side: LedgerPostingSideSchema,
  amountMinor: MinorUnitAmountStringSchema,
  currency: CurrencyCodeSchema,
  correlationId: z.string().trim().min(1).max(256),
  idempotencyKey: z.string().trim().min(1).max(256),
  reversesLineId: FinanceUuidSchema.optional(),
  createdAt: IsoDateTimeStringSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export type LedgerJournalBalanceViolationCode =
  | "DOUBLE_ENTRY_IMBALANCE"
  | "MISSING_DEBIT"
  | "MISSING_CREDIT"
  | "JOURNAL_ID_MISMATCH"
  | "TENANT_ID_MISMATCH";

export type LedgerJournalBalanceViolation = {
  code: LedgerJournalBalanceViolationCode;
  message: string;
  currency?: string;
};

export type LedgerJournalBalanceInput = Pick<
  LedgerEntry,
  "journalId" | "tenantId" | "side" | "amountMinor" | "currency"
>;

/**
 * Double-entry invariant: per currency, total debits === total credits (minor units).
 * Aligns with {@link postDoubleEntryJournal} (≥1 debit, ≥1 credit; today exactly two lines).
 */
export function findLedgerJournalBalanceViolations(
  lines: readonly LedgerJournalBalanceInput[],
  envelope?: { journalId: string; tenantId: string },
): LedgerJournalBalanceViolation[] {
  const violations: LedgerJournalBalanceViolation[] = [];

  if (lines.length < 2) {
    violations.push({
      code: "DOUBLE_ENTRY_IMBALANCE",
      message: "ledger journal requires at least two lines",
    });
    return violations;
  }

  let hasDebit = false;
  let hasCredit = false;
  const debitByCurrency = new Map<string, bigint>();
  const creditByCurrency = new Map<string, bigint>();

  for (const line of lines) {
    if (envelope && line.journalId !== envelope.journalId) {
      violations.push({
        code: "JOURNAL_ID_MISMATCH",
        message: `line journalId ${line.journalId} does not match journal ${envelope.journalId}`,
      });
    }
    if (envelope && line.tenantId !== envelope.tenantId) {
      violations.push({
        code: "TENANT_ID_MISMATCH",
        message: `line tenantId ${line.tenantId} does not match journal ${envelope.tenantId}`,
      });
    }

    const amount = BigInt(line.amountMinor);
    const currency = line.currency;
    if (line.side === "debit") {
      hasDebit = true;
      debitByCurrency.set(currency, (debitByCurrency.get(currency) ?? 0n) + amount);
    } else {
      hasCredit = true;
      creditByCurrency.set(currency, (creditByCurrency.get(currency) ?? 0n) + amount);
    }
  }

  if (!hasDebit) {
    violations.push({
      code: "MISSING_DEBIT",
      message: "ledger journal must include at least one debit line",
    });
  }
  if (!hasCredit) {
    violations.push({
      code: "MISSING_CREDIT",
      message: "ledger journal must include at least one credit line",
    });
  }

  const currencies = new Set([...debitByCurrency.keys(), ...creditByCurrency.keys()]);
  for (const currency of currencies) {
    const debits = debitByCurrency.get(currency) ?? 0n;
    const credits = creditByCurrency.get(currency) ?? 0n;
    if (debits !== credits) {
      violations.push({
        code: "DOUBLE_ENTRY_IMBALANCE",
        message: `debits (${debits}) must equal credits (${credits}) for currency ${currency}`,
        currency,
      });
    }
  }

  return violations;
}

export function isBalancedLedgerJournal(
  lines: readonly LedgerJournalBalanceInput[],
  envelope?: { journalId: string; tenantId: string },
): boolean {
  return findLedgerJournalBalanceViolations(lines, envelope).length === 0;
}

export function assertLedgerJournalDoubleEntry(
  lines: readonly LedgerJournalBalanceInput[],
  envelope?: { journalId: string; tenantId: string },
): void {
  const violations = findLedgerJournalBalanceViolations(lines, envelope);
  if (violations.length === 0) {
    return;
  }
  const summary = violations.map((v) => v.message).join("; ");
  throw new Error(`LEDGER_DOUBLE_ENTRY_INVALID: ${summary}`);
}

/**
 * Balanced journal envelope + lines (`ledger_journal_batches` + `ledger_journal_lines`).
 */
export const LedgerJournalSchema = z
  .object({
    journalId: FinanceUuidSchema,
    tenantId: FinanceUuidSchema,
    lines: z.array(LedgerEntrySchema).min(2, "ledger journal requires at least two lines"),
  })
  .superRefine((journal, ctx) => {
    const violations = findLedgerJournalBalanceViolations(journal.lines, {
      journalId: journal.journalId,
      tenantId: journal.tenantId,
    });
    for (const violation of violations) {
      ctx.addIssue({
        code: "custom",
        message: violation.message,
        path: ["lines"],
      });
    }
  });

export type LedgerJournal = z.infer<typeof LedgerJournalSchema>;

/** Named finance schemas for discovery and incremental registration. */
export const financeSchemaRegistry = {
  paymentIntent: PaymentIntentSchema,
  paymentReceipt: PaymentReceiptSchema,
  paymentStatus: PaymentStatusSchema,
  paymentStatusTransitions: PAYMENT_STATUS_TRANSITIONS,
  paymentMethod: PaymentMethodSchema,
  receiptStatus: ReceiptStatusSchema,
  ledgerAccountId: LedgerAccountIdSchema,
  ledgerEntry: LedgerEntrySchema,
  ledgerJournal: LedgerJournalSchema,
  ledgerPostingSide: LedgerPostingSideSchema,
} as const;
