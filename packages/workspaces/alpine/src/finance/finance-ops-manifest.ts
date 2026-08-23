export type AlpineFinanceOpsManifest = {
  readonly version: "1";
  readonly panels: {
    readonly overview: boolean;
    readonly payments: boolean;
    readonly receipts: boolean;
    readonly prepayments: boolean;
    readonly installments: boolean;
    readonly ledger: boolean;
  };
  readonly currencies: readonly string[];
};

export const DEFAULT_ALPINE_FINANCE_OPS_MANIFEST: AlpineFinanceOpsManifest = Object.freeze({
  version: "1",
  panels: Object.freeze({
    overview: true,
    payments: true,
    receipts: true,
    prepayments: false,
    installments: false,
    ledger: true,
  }),
  currencies: Object.freeze(["CHF"]),
});

export function resolveAlpineFinanceOpsManifestFromTheme(_theme: unknown): AlpineFinanceOpsManifest {
  return DEFAULT_ALPINE_FINANCE_OPS_MANIFEST;
}
