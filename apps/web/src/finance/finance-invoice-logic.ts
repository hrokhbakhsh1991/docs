export const FINANCE_INVOICE_TEST_IDS = {
  lookupForm: "finance-invoice-lookup-form",
  balancePanel: "finance-invoice-balance-panel",
} as const;

export type RegistrationInvoice = {
  readonly registrationId: string;
  readonly currency: string;
  readonly invoiceTotalMinor: string;
  readonly paidAmountMinor: string;
  readonly balanceDueMinor: string;
  readonly walletNetMinor: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRegistrationInvoice(raw: unknown): RegistrationInvoice | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const registrationId = String(record.registrationId ?? "");
  if (!UUID_PATTERN.test(registrationId)) {
    return null;
  }
  return {
    registrationId,
    currency: String(record.currency ?? "IRR"),
    invoiceTotalMinor: String(record.invoiceTotalMinor ?? "0"),
    paidAmountMinor: String(record.paidAmountMinor ?? "0"),
    balanceDueMinor: String(record.balanceDueMinor ?? "0"),
    walletNetMinor: String(record.walletNetMinor ?? "0"),
  };
}

export function validateInvoiceLookupRegistrationId(
  registrationId: string
): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = registrationId.trim();
  if (!UUID_PATTERN.test(normalized)) {
    return { ok: false, error: "REGISTRATION_ID_INVALID" };
  }
  return { ok: true, value: normalized };
}

export function buildInvoiceLookupPath(registrationId: string): string {
  return `/api/finance/invoices/${encodeURIComponent(registrationId)}`;
}
