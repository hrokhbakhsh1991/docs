/**
 * Finance ops panel capability contract (Phase 1.9.2).
 * Workspace packages supply concrete defaults via `workspaceFinance.opsManifest`;
 * host resolves through generated bindings — never hard-imports a workspace package.
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
