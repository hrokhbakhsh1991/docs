import type { AppLocale } from "@/i18n/routing";
import {
  formatGroupedDigitsString,
  formatLocalizedNumber,
  INTL_LOCALE,
  toLocalizedDigits,
} from "@/i18n/format-localized-digits";
import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import { parseFinanceRegistrationContext } from "@/finance/finance-registration-context";

export const FINANCE_PREPAYMENTS_TEST_IDS = {
  panel: "finance-prepayments-panel",
  list: "finance-prepayments-list",
  recordForm: "finance-prepayment-record-form",
  emptyState: "finance-prepayments-empty",
} as const;

export type PrepaymentRecord = {
  readonly id: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: string;
  readonly note: string | null;
  readonly recordedAt: string;
  readonly registrationContext: FinanceRegistrationContext | null;
};

export type PrepaymentsListResponse = {
  readonly items: readonly PrepaymentRecord[];
};

export type RecordPrepaymentFormState = {
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: string;
  readonly note: string;
};

export type RecordPrepaymentValidation =
  | { readonly ok: true; readonly value: RecordPrepaymentFormState }
  | { readonly ok: false; readonly error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePrepaymentsListResponse(raw: unknown): PrepaymentsListResponse {
  if (raw === null || typeof raw !== "object") {
    return { items: [] };
  }
  const record = raw as Record<string, unknown>;
  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw)) {
    return { items: [] };
  }
  const items = itemsRaw
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
    )
    .map((entry) => ({
      id: String(entry.id ?? ""),
      registrationId: String(entry.registrationId ?? ""),
      amountMinor: String(entry.amountMinor ?? "0"),
      currency: String(entry.currency ?? ""),
      method: String(entry.method ?? "Manual"),
      note: typeof entry.note === "string" ? entry.note : null,
      recordedAt: String(entry.recordedAt ?? ""),
      registrationContext: parseFinanceRegistrationContext(entry.registrationContext),
    }))
    .filter((entry) => entry.id.length > 0);
  return { items };
}

export function validateRecordPrepaymentForm(
  input: RecordPrepaymentFormState
): RecordPrepaymentValidation {
  const registrationId = input.registrationId.trim();
  if (!UUID_PATTERN.test(registrationId)) {
    return { ok: false, error: "REGISTRATION_ID_INVALID" };
  }
  const amountMinor = input.amountMinor.trim();
  if (!/^\d+$/.test(amountMinor) || amountMinor === "0") {
    return { ok: false, error: "AMOUNT_POSITIVE_INTEGER" };
  }
  const currency = input.currency.trim().toUpperCase();
  if (currency.length < 3 || currency.length > 8) {
    return { ok: false, error: "CURRENCY_LENGTH" };
  }
  const method = input.method.trim();
  if (method.length === 0 || method.length > 64) {
    return { ok: false, error: "PAYMENT_METHOD_REQUIRED" };
  }
  const note = input.note.trim();
  if (note.length > 2000) {
    return { ok: false, error: "NOTE_MAX_LENGTH" };
  }
  return {
    ok: true,
    value: {
      registrationId,
      amountMinor,
      currency,
      method,
      note,
    },
  };
}

export function formatMinorAmount(
  amountMinor: string,
  currency: string,
  locale: AppLocale = "en"
): string {
  const digits = amountMinor.replace(/\D/g, "");
  if (digits.length === 0) {
    return `${formatLocalizedNumber(0, locale)} ${currency}`;
  }
  return `${formatGroupedDigitsString(digits, locale)} ${currency}`;
}

export function formatPrepaymentRecordedAt(iso: string, locale: AppLocale = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return toLocalizedDigits(
    date.toLocaleString(INTL_LOCALE[locale], {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    locale
  );
}

export function buildRecordPrepaymentRequestBody(
  value: RecordPrepaymentFormState
): Record<string, unknown> {
  return {
    registrationId: value.registrationId,
    amountMinor: value.amountMinor,
    currency: value.currency,
    method: value.method,
    ...(value.note.length > 0 ? { note: value.note } : {}),
  };
}
