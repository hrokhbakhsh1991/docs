/**
 * Finance ops UI capability contract (Phase 1.10.1).
 *
 * Workspace packages supply concrete defaults via `workspaceFinance.opsManifest`.
 * Generic web depends on this capability type only — never on product workspace
 * finance manifest modules. Resolve through generated bindings.
 */
export type FinanceOpsCapability = {
  readonly version: "1";
  readonly panels: {
    readonly overview: boolean;
    readonly payments: boolean;
    readonly receipts: boolean;
    readonly prepayments: boolean;
    readonly installments: boolean;
    readonly ledger: boolean;
    /** PR23-E3 — manual offline refunds workflow. */
    readonly refunds: boolean;
    /** PR23 UX-1 — outstanding AR from D1/D2 reports (read-only). */
    readonly outstanding: boolean;
  };
  readonly installmentDefaults?: {
    readonly enabled: boolean;
    readonly depositPercent?: number;
    readonly installmentCount?: number;
    readonly graceDays?: number;
  };
  readonly currencies: readonly string[];
};

/** @deprecated Prefer {@link FinanceOpsCapability} — structural alias for older call sites. */
export type FinanceOpsManifest = FinanceOpsCapability;
