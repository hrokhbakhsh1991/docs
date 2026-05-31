import type { TourFormProfile } from "@repo/types";
import { TOUR_CREATE_CONTRACT_FIELDS } from "@repo/shared-contracts";
import { TENANT_MODULE_IDS, type TenantModuleId } from "@repo/shared";

import type { TourCreateWizardValidationFlags } from "@/features/tours/wizard/schemas/classic/tourCreateValidationPolicy";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import {
  GROUP_TO_TOUR_CREATE_ROOT_KEYS,
  STEP_PRIMARY_FIELD_GROUP,
  getVisibleWizardStepsForProfile,
  tourCreateRootKeyFromTriggerPath,
  type FieldGroupId,
} from "@/features/tours/wizard/fieldGroups";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

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

/** Field groups gated behind the workspace `form_builder` module. */
export const TENANT_ADVANCED_TRIP_FIELD_GROUPS = [
  "itinerary",
  "participation",
  "logistics",
] as const satisfies readonly FieldGroupId[];

const TENANT_ADVANCED_TRIP_FIELD_GROUP_SET = new Set<FieldGroupId>(TENANT_ADVANCED_TRIP_FIELD_GROUPS);

const TENANT_ADVANCED_TRIP_ROOT_KEYS = new Set<keyof TourCreateFormValues>(
  TENANT_ADVANCED_TRIP_FIELD_GROUPS.flatMap((g) => [...GROUP_TO_TOUR_CREATE_ROOT_KEYS[g]]),
);

export function getTenantGatedInactiveFieldGroups(
  contract: TenantTourFormContract,
): ReadonlySet<FieldGroupId> {
  if (contract.allowAdvancedTripDetails) {
    return new Set();
  }
  return TENANT_ADVANCED_TRIP_FIELD_GROUP_SET;
}

/** True when the field is not blocked by missing `form_builder` on the workspace. */
export function isFieldVisibleForTenantContract(
  path: string,
  contract: TenantTourFormContract,
): boolean {
  if (contract.allowAdvancedTripDetails) {
    return true;
  }
  const root = tourCreateRootKeyFromTriggerPath(path);
  if (root == null) {
    return true;
  }
  return !TENANT_ADVANCED_TRIP_ROOT_KEYS.has(root);
}

export function getVisibleWizardStepsForTenantContract(
  profile: TourFormProfile,
  contract: TenantTourFormContract,
): readonly TourCreateWizardStepId[] {
  const gated = getTenantGatedInactiveFieldGroups(contract);
  if (gated.size === 0) {
    return getVisibleWizardStepsForProfile(profile);
  }
  return getVisibleWizardStepsForProfile(profile).filter((step) => {
    const group = STEP_PRIMARY_FIELD_GROUP[step];
    return group == null || !gated.has(group);
  });
}

export function tenantGatedInactiveTourCreateRoots(
  contract: TenantTourFormContract,
): readonly (keyof TourCreateFormValues)[] {
  if (contract.allowAdvancedTripDetails) {
    return [];
  }
  return [...TENANT_ADVANCED_TRIP_ROOT_KEYS];
}

/** Zod / rules relax flags when `form_builder` is off (mirrors hidden advanced steps). */
export function tenantModuleWizardValidationFlags(
  contract: TenantTourFormContract,
): TourCreateWizardValidationFlags {
  if (contract.allowAdvancedTripDetails) {
    return {
      relaxItineraryMinDays: false,
      relaxLogisticsPrimary: false,
      requiresMountainTransportEconomics: false,
    };
  }
  return {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
    requiresMountainTransportEconomics: false,
  };
}

export function mergeWizardValidationFlagsWithTenant(
  base: TourCreateWizardValidationFlags,
  contract: TenantTourFormContract,
): TourCreateWizardValidationFlags {
  const tenant = tenantModuleWizardValidationFlags(contract);
  return {
    relaxItineraryMinDays: base.relaxItineraryMinDays || tenant.relaxItineraryMinDays,
    relaxLogisticsPrimary: base.relaxLogisticsPrimary || tenant.relaxLogisticsPrimary,
    requiresMountainTransportEconomics:
      base.requiresMountainTransportEconomics || tenant.requiresMountainTransportEconomics,
  };
}

export function stripTenantGatedTourCreateGroups(
  contract: TenantTourFormContract,
  values: TourCreateFormValues,
): TourCreateFormValues {
  const roots = tenantGatedInactiveTourCreateRoots(contract);
  if (roots.length === 0) {
    return values;
  }
  const template = buildTourCreateFormDefaultValues();
  let next: TourCreateFormValues = values;
  for (const root of roots) {
    next = { ...next, [root]: template[root] };
  }
  return next;
}
