import { TOUR_CREATE_CONTRACT_FIELDS } from "@repo/shared-contracts";
import { TENANT_MODULE_IDS, type TenantModuleId } from "@repo/shared";

/**
 * Per-tenant overlay on the shared tour CREATE wire contract (Phase 8.2.1).
 * `formProfile` drives field visibility; `tenantModules` gates product modules.
 */
export type TenantTourFormContract = {
  tenantModules: readonly TenantModuleId[];
  allowAdvancedTripDetails: boolean;
  allowFinanceSurfaces: boolean;
};

const MODULE_SET = new Set<string>(TENANT_MODULE_IDS);

function normalizeTenantModules(raw: readonly string[] | null | undefined): TenantModuleId[] {
  const out: TenantModuleId[] = [];
  for (const entry of raw ?? []) {
    const id = entry.trim().toLowerCase();
    if (MODULE_SET.has(id)) {
      out.push(id as TenantModuleId);
    }
  }
  return out;
}

export function resolveTenantTourFormContract(
  tenantModules: readonly string[] | null | undefined,
): TenantTourFormContract {
  const modules = normalizeTenantModules(tenantModules);
  const moduleSet = new Set(modules);
  return {
    tenantModules: modules,
    allowAdvancedTripDetails: moduleSet.has("form_builder"),
    allowFinanceSurfaces: moduleSet.has("finance"),
  };
}

/**
 * Returns CREATE wire keys documented for this tenant (same keys today; finance gating is UI/RBAC).
 */
export function allowedTourCreateWireKeysForTenant(
  _contract: TenantTourFormContract,
): readonly string[] {
  return TOUR_CREATE_CONTRACT_FIELDS;
}
