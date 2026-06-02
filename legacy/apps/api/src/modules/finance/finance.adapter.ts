import {
  PaymentIntentSchema,
  type PaymentIntent,
  type PaymentMethod,
  type PaymentStatus,
} from "@repo/shared-contracts";
import type { PaymentEntity } from "../payments/entities/payment.entity";

/** Default timestamp when legacy/partial payloads omit createdAt (e.g. pre-persist contract checks). */
const DEFAULT_CONTRACT_CREATED_AT = "1970-01-01T00:00:00.000Z";

function asLegacyRecord(legacyData: unknown): Record<string, unknown> {
  if (legacyData === null || legacyData === undefined) {
    return {};
  }
  if (typeof legacyData !== "object") {
    return { value: legacyData };
  }
  return legacyData as Record<string, unknown>;
}

function readField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): unknown {
  if (camelKey in record) {
    return record[camelKey];
  }
  if (snakeKey in record) {
    return record[snakeKey];
  }
  return undefined;
}

function toIsoDateTimeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

function toUuidString(value: unknown, fallback: string): string {
  const raw = toNonEmptyString(value, fallback);
  return raw;
}

function toNullableUuidString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = toNonEmptyString(value, "");
  return raw.length > 0 ? raw : null;
}

function toNullableProviderPaymentId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = toNonEmptyString(value, "");
  return raw.length > 0 ? raw : null;
}

function toAmountMinorString(value: unknown): string {
  if (typeof value === "bigint") {
    return value > 0n ? value.toString() : "1";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? String(n) : "1";
  }
  const raw = toNonEmptyString(value, "1");
  if (/^\d+$/.test(raw) && raw !== "0") {
    return raw;
  }
  return "1";
}

function toPaymentStatus(value: unknown): PaymentStatus {
  const raw = toNonEmptyString(value, "Pending");
  const parsed = PaymentIntentSchema.shape.status.safeParse(raw);
  return parsed.success ? parsed.data : "Pending";
}

function toPaymentMethod(value: unknown): PaymentMethod {
  const raw = toNonEmptyString(value, "Online");
  const parsed = PaymentIntentSchema.shape.method.safeParse(raw);
  return parsed.success ? parsed.data : "Online";
}

/**
 * Maps legacy payment rows/DTOs/snapshots into the wire shape expected by {@link PaymentIntentSchema}.
 * Accepts `PaymentEntity`, `PaymentResponseDto`, snake_case API payloads, and partial snapshots.
 */
export function normalizeLegacyPaymentIntentWire(legacyData: unknown): Record<string, unknown> {
  const record = asLegacyRecord(legacyData);
  const nowIso = new Date().toISOString();

  const createdAt =
    toIsoDateTimeString(readField(record, "createdAt", "created_at")) ??
    DEFAULT_CONTRACT_CREATED_AT;
  const updatedAt =
    toIsoDateTimeString(readField(record, "updatedAt", "updated_at")) ?? createdAt ?? nowIso;

  const deletedAtRaw = readField(record, "deletedAt", "deleted_at");
  const deletedAt =
    deletedAtRaw === undefined ? undefined : toIsoDateTimeString(deletedAtRaw);

  return {
    id: toUuidString(readField(record, "id", "id"), "00000000-0000-4000-8000-000000000000"),
    tenantId: toUuidString(
      readField(record, "tenantId", "tenant_id"),
      "00000000-0000-4000-8000-000000000001",
    ),
    registrationId: toUuidString(
      readField(record, "registrationId", "registration_id"),
      "00000000-0000-4000-8000-000000000002",
    ),
    amount: toAmountMinorString(readField(record, "amount", "amount")),
    currency: toNonEmptyString(readField(record, "currency", "currency"), "USD").toUpperCase(),
    method: toPaymentMethod(readField(record, "method", "method")),
    provider: toNonEmptyString(readField(record, "provider", "provider"), "unknown"),
    providerPaymentId: toNullableProviderPaymentId(
      readField(record, "providerPaymentId", "provider_payment_id"),
    ),
    status: toPaymentStatus(readField(record, "status", "status")),
    paidAt: toIsoDateTimeString(readField(record, "paidAt", "paid_at")),
    failedAt: toIsoDateTimeString(readField(record, "failedAt", "failed_at")),
    refundedAt: toIsoDateTimeString(readField(record, "refundedAt", "refunded_at")),
    ledgerJournalId: toNullableUuidString(
      readField(record, "ledgerJournalId", "ledger_journal_id"),
    ),
    createdAt,
    updatedAt,
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

/**
 * Bridges legacy payment payloads to the shared {@link PaymentIntent} contract.
 * Validates with {@link PaymentIntentSchema}; throws {@link ZodError} on failure.
 * {@link PaymentsService} enforces via `enforcePaymentIntentFinanceContract` on all write paths.
 */
export function toFinanceContract(legacyData: unknown): PaymentIntent {
  const wire = normalizeLegacyPaymentIntentWire(legacyData);
  return PaymentIntentSchema.parse(wire);
}

/** Convenience when the caller already has a loaded `PaymentEntity`. */
export function toFinanceContractFromPaymentEntity(entity: PaymentEntity): PaymentIntent {
  return toFinanceContract(entity);
}
