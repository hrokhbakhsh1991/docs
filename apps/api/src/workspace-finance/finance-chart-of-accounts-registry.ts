/**
 * Chart-of-accounts capability resolve (Phase 1.10 / P4-D3.a) — generated from workspaceFinance.chartOfAccounts.
 * Fail-closed: unregistered workspaceType throws.
 * Loads product CoA via allowlisted dynamic import() (no static fan-in).
 */

import {
  isFinanceChartOfAccountsBindingRegistered,
  listFinanceChartOfAccountsWorkspaceTypes,
  WORKSPACE_FINANCE_CHART_OF_ACCOUNTS_BINDINGS,
} from "./workspace-finance-chart-of-accounts-bindings.generated";

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

export function isFinanceChartOfAccountsRegistered(workspaceType: string): boolean {
  const normalized = normalizeWorkspaceType(workspaceType);
  return normalized.length > 0 && isFinanceChartOfAccountsBindingRegistered(normalized);
}

export function listRegisteredFinanceChartOfAccountsWorkspaceTypes(): readonly string[] {
  return listFinanceChartOfAccountsWorkspaceTypes();
}

/**
 * Resolve workspace chart-of-accounts constant object (audit / policy companion).
 * @throws `FINANCE_CHART_OF_ACCOUNTS_UNSUPPORTED` when not registered.
 */
export async function resolveFinanceChartOfAccounts(
  workspaceType: string
): Promise<Readonly<Record<string, string>>> {
  const normalized = normalizeWorkspaceType(workspaceType);
  if (normalized.length === 0) {
    throw new Error(
      "FINANCE_CHART_OF_ACCOUNTS_UNSUPPORTED: workspaceType is required to resolve chart of accounts"
    );
  }
  const binding =
    WORKSPACE_FINANCE_CHART_OF_ACCOUNTS_BINDINGS[
      normalized as keyof typeof WORKSPACE_FINANCE_CHART_OF_ACCOUNTS_BINDINGS
    ];
  if (binding === undefined) {
    throw new Error(
      `FINANCE_CHART_OF_ACCOUNTS_UNSUPPORTED: no chart of accounts for workspaceType=${workspaceType}`
    );
  }
  return binding.loadAccounts();
}
