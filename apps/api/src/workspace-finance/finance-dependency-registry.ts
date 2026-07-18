/**
 * Finance dependency registry — apps/api composition layer.
 *
 * Maps workspaceType → ledger policy + offline receipt defaults.
 * Phase 1.3: Denali (production boot default) + finance-ws2 (architecture fixture).
 * Boot and FinanceService must not construct workspace adapter classes; resolve via this module.
 *
 * Registration keys are literal workspace type ids (avoid importing workspace packages here).
 */

import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter";
import { DenaliFinanceReceiptDefaultsAdapter } from "./infrastructure/denali-finance-receipt-defaults.adapter";
import { FINANCE_WS2_WORKSPACE_TYPE } from "./infrastructure/finance-ws2-chart-of-accounts";
import { FinanceWs2LedgerPolicyAdapter } from "./infrastructure/finance-ws2-ledger-policy.adapter";
import { FinanceWs2ReceiptDefaultsAdapter } from "./infrastructure/finance-ws2-receipt-defaults.adapter";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port";
import type { FinanceReceiptDefaultsPort } from "./ports/finance-receipt-defaults.port";

/** Must match `@app-cloud/workspace-denali` DENALI_WORKSPACE_TYPE — avoid importing the package here. */
const DENALI_WORKSPACE_TYPE = "denali";

/**
 * Production boot singleton workspace type until per-tenant resolution lands.
 * Multi-registration is allowed; boot must not use “sole registered” semantics.
 */
export const BOOT_FINANCE_WORKSPACE_TYPE = DENALI_WORKSPACE_TYPE;

export type FinanceWorkspaceDependencyFactories = {
  readonly createLedgerPolicy: () => FinanceLedgerPolicyPort;
  readonly createReceiptDefaults: () => FinanceReceiptDefaultsPort;
};

const FINANCE_DEPENDENCY_REGISTRY: ReadonlyMap<string, FinanceWorkspaceDependencyFactories> =
  new Map([
    [
      DENALI_WORKSPACE_TYPE,
      {
        createLedgerPolicy: () => new DenaliFinanceLedgerPolicyAdapter(),
        createReceiptDefaults: () => new DenaliFinanceReceiptDefaultsAdapter(),
      },
    ],
    [
      FINANCE_WS2_WORKSPACE_TYPE,
      {
        createLedgerPolicy: () => new FinanceWs2LedgerPolicyAdapter(),
        createReceiptDefaults: () => new FinanceWs2ReceiptDefaultsAdapter(),
      },
    ],
  ]);

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

function requireRegisteredFactories(
  workspaceType: string,
  unsupportedCode: "FINANCE_LEDGER_POLICY_UNSUPPORTED" | "FINANCE_RECEIPT_DEFAULTS_UNSUPPORTED"
): FinanceWorkspaceDependencyFactories {
  const normalized = normalizeWorkspaceType(workspaceType);
  if (normalized.length === 0) {
    throw new Error(
      "FINANCE_WORKSPACE_TYPE_REQUIRED: workspaceType is required to resolve finance dependencies"
    );
  }
  const factories = FINANCE_DEPENDENCY_REGISTRY.get(normalized);
  if (factories === undefined) {
    throw new Error(
      `${unsupportedCode}: no finance dependency registration for workspaceType=${workspaceType}`
    );
  }
  return factories;
}

/**
 * Boot singleton workspace type (Denali). Not “sole registered” — registry also holds finance-ws2.
 */
export function resolveBootFinanceWorkspaceType(): string {
  if (!FINANCE_DEPENDENCY_REGISTRY.has(BOOT_FINANCE_WORKSPACE_TYPE)) {
    throw new Error(
      `FINANCE_BOOT_WORKSPACE_UNREGISTERED: boot workspaceType=${BOOT_FINANCE_WORKSPACE_TYPE} missing from registry`
    );
  }
  return BOOT_FINANCE_WORKSPACE_TYPE;
}

/** @deprecated Use {@link resolveBootFinanceWorkspaceType}. */
export function resolveSoleRegisteredFinanceWorkspaceType(): string {
  return resolveBootFinanceWorkspaceType();
}

export function listRegisteredFinanceWorkspaceTypes(): readonly string[] {
  return [...FINANCE_DEPENDENCY_REGISTRY.keys()].sort();
}

export function resolveFinanceLedgerPolicy(workspaceType: string): FinanceLedgerPolicyPort {
  return requireRegisteredFactories(workspaceType, "FINANCE_LEDGER_POLICY_UNSUPPORTED").createLedgerPolicy();
}

export function resolveFinanceReceiptDefaults(workspaceType: string): FinanceReceiptDefaultsPort {
  return requireRegisteredFactories(
    workspaceType,
    "FINANCE_RECEIPT_DEFAULTS_UNSUPPORTED"
  ).createReceiptDefaults();
}
