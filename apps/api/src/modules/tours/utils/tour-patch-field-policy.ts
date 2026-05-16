import {
  resolveEffectiveCapabilities,
  type CapabilityGrantContext,
} from "@repo/shared";
import {
  TOUR_PATCH_CONTRACT_RULES,
  type TourPatchContractDtoKey,
  type TourPatchContractRule,
  type TourPatchFieldGroup,
  type TourPatchViewerRole,
} from "@repo/shared-contracts";

export type { TourPatchFieldGroup, TourPatchViewerRole };
export type TourPatchDtoKey = TourPatchContractDtoKey;
export type TourPatchFieldPolicyRule = TourPatchContractRule;

/**
 * PATCH field matrix: capability slice + optional role rank per DTO key.
 * Coarse endpoint roles and CASL (`assertTourPatchAbilities`) run before this layer.
 */
export const TOUR_PATCH_FIELD_POLICY_RULES: readonly TourPatchFieldPolicyRule[] =
  TOUR_PATCH_CONTRACT_RULES;

function roleRank(role: TourPatchViewerRole): number {
  if (role === "guest") return 0;
  if (role === "member") return 1;
  if (role === "leader") return 2;
  return 3;
}

function meetsMinRole(current: TourPatchViewerRole, min: TourPatchViewerRole): boolean {
  return roleRank(current) >= roleRank(min);
}

const rulesByKey = new Map<TourPatchDtoKey, TourPatchFieldPolicyRule>(
  TOUR_PATCH_FIELD_POLICY_RULES.map((rule) => [rule.dtoKey, rule]),
);

export function getTourPatchFieldPolicyRule(
  dtoKey: string,
): TourPatchFieldPolicyRule | undefined {
  return rulesByKey.get(dtoKey as TourPatchDtoKey);
}

/**
 * DTO keys present in the PATCH body that fail capability or role-rank gates.
 */
export function getForbiddenTourPatchDtoKeysForPatchContext(
  viewerRole: TourPatchViewerRole,
  capabilityContext: CapabilityGrantContext,
  presentKeys: readonly string[],
): TourPatchDtoKey[] {
  const present = new Set(presentKeys);
  const effective = new Set(resolveEffectiveCapabilities(capabilityContext));
  const forbidden: TourPatchDtoKey[] = [];

  for (const rule of TOUR_PATCH_FIELD_POLICY_RULES) {
    if (!present.has(rule.dtoKey)) {
      continue;
    }
    if (!effective.has(rule.requiredCapability)) {
      forbidden.push(rule.dtoKey);
      continue;
    }
    if (rule.minRoleForEdit && !meetsMinRole(viewerRole, rule.minRoleForEdit)) {
      forbidden.push(rule.dtoKey);
    }
  }

  return forbidden.sort((a, b) => a.localeCompare(b));
}
