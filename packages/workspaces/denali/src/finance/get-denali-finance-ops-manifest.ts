import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  type FinanceOpsManifest,
} from "./finance-ops-manifest";

/** Phase 9.7 — finance command center panel manifest (Denali-only). */
export function getDenaliFinanceOpsManifest(): FinanceOpsManifest {
  return DEFAULT_FINANCE_OPS_MANIFEST;
}
