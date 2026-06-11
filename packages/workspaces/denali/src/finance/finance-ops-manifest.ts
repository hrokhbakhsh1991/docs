/**
 * Phase 9.7 — Denali finance operator manifest (DEC-P9-016).
 * @see docs/phase-9/appendices/FINANCE-OPS-UX.md §7
 */
export type FinanceOpsManifest = {
  readonly version: "1";
  readonly panels: {
    readonly overview: boolean;
    readonly payments: boolean;
    readonly receipts: boolean;
    readonly prepayments: boolean;
    readonly installments: boolean;
    readonly ledger: boolean;
  };
  readonly installmentDefaults?: {
    readonly enabled: boolean;
    readonly depositPercent?: number;
    readonly installmentCount?: number;
    readonly graceDays?: number;
  };
  readonly currencies: readonly string[];
};

export const DEFAULT_FINANCE_OPS_MANIFEST: FinanceOpsManifest = Object.freeze({
  version: "1",
  panels: Object.freeze({
    overview: true,
    payments: true,
    receipts: true,
    prepayments: true,
    installments: false,
    ledger: true,
  }),
  installmentDefaults: Object.freeze({
    enabled: false,
    depositPercent: 30,
    installmentCount: 3,
    graceDays: 7,
  }),
  currencies: Object.freeze(["IRR", "USD"]),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

/** Merge tenant theme `financeOps` overrides onto the Denali default manifest. */
export function resolveFinanceOpsManifestFromTheme(theme: unknown): FinanceOpsManifest {
  if (!isRecord(theme)) {
    return DEFAULT_FINANCE_OPS_MANIFEST;
  }
  const raw = theme.financeOps;
  if (!isRecord(raw)) {
    return DEFAULT_FINANCE_OPS_MANIFEST;
  }
  const panelsRaw = isRecord(raw.panels) ? raw.panels : {};
  const installmentRaw = isRecord(raw.installmentDefaults) ? raw.installmentDefaults : {};
  const currenciesRaw = Array.isArray(raw.currencies)
    ? raw.currencies.filter((c): c is string => typeof c === "string")
    : DEFAULT_FINANCE_OPS_MANIFEST.currencies;

  return Object.freeze({
    version: "1",
    panels: Object.freeze({
      overview: readBoolean(panelsRaw, "overview", DEFAULT_FINANCE_OPS_MANIFEST.panels.overview),
      payments: readBoolean(panelsRaw, "payments", DEFAULT_FINANCE_OPS_MANIFEST.panels.payments),
      receipts: readBoolean(panelsRaw, "receipts", DEFAULT_FINANCE_OPS_MANIFEST.panels.receipts),
      prepayments: readBoolean(
        panelsRaw,
        "prepayments",
        DEFAULT_FINANCE_OPS_MANIFEST.panels.prepayments
      ),
      installments: readBoolean(
        panelsRaw,
        "installments",
        DEFAULT_FINANCE_OPS_MANIFEST.panels.installments
      ),
      ledger: readBoolean(panelsRaw, "ledger", DEFAULT_FINANCE_OPS_MANIFEST.panels.ledger),
    }),
    installmentDefaults: Object.freeze({
      enabled: readBoolean(
        installmentRaw,
        "enabled",
        DEFAULT_FINANCE_OPS_MANIFEST.installmentDefaults?.enabled ?? false
      ),
      depositPercent:
        typeof installmentRaw.depositPercent === "number"
          ? installmentRaw.depositPercent
          : DEFAULT_FINANCE_OPS_MANIFEST.installmentDefaults?.depositPercent,
      installmentCount:
        typeof installmentRaw.installmentCount === "number"
          ? installmentRaw.installmentCount
          : DEFAULT_FINANCE_OPS_MANIFEST.installmentDefaults?.installmentCount,
      graceDays:
        typeof installmentRaw.graceDays === "number"
          ? installmentRaw.graceDays
          : DEFAULT_FINANCE_OPS_MANIFEST.installmentDefaults?.graceDays,
    }),
    currencies: Object.freeze(
      currenciesRaw.length > 0 ? currenciesRaw : DEFAULT_FINANCE_OPS_MANIFEST.currencies
    ),
  });
}

export function assertDenaliFinanceWorkspace(workspaceType: string): void {
  if (workspaceType !== "denali") {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
}
