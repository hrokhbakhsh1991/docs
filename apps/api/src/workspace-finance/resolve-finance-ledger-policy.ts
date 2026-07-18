import { DENALI_WORKSPACE_TYPE } from "@app-tour/workspace-denali";

import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port";

/**
 * Boot / composition resolver for workspace ledger policy.
 * Phase 0: only Denali is finance-supported; call sites must not construct adapters inline.
 */
export function resolveFinanceLedgerPolicy(
  workspaceType: string = DENALI_WORKSPACE_TYPE
): FinanceLedgerPolicyPort {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized === DENALI_WORKSPACE_TYPE || normalized.length === 0) {
    return new DenaliFinanceLedgerPolicyAdapter();
  }
  // Phase 0: no other workspace policies registered — fail closed rather than silently use Denali.
  throw new Error(
    `FINANCE_LEDGER_POLICY_UNSUPPORTED: no FinanceLedgerPolicyPort registered for workspaceType=${workspaceType}`
  );
}
