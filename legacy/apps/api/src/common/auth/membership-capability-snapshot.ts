import { encodeJwtCapabilitySnapshot, resolveEffectiveCapabilities } from "@repo/shared";

import { normalizeMembershipLabels } from "../rbac/normalize-membership-labels";
import { parseTenantEnabledModules } from "../rbac/parse-tenant-enabled-modules";
import type { MembershipAbilityHydrationRow } from "../middleware/hydrate-workspace-ability-context";

export function resolveEffectiveCapabilitiesFromHydrationRow(
  role: string,
  row: MembershipAbilityHydrationRow,
): readonly string[] {
  const labels = normalizeMembershipLabels(row.labels);
  const tenantModules = parseTenantEnabledModules(row.enabled_modules);
  return resolveEffectiveCapabilities({
    role,
    labels,
    membershipMetadata: row.membership_metadata,
    tenantModules,
  });
}

export function encodeMembershipJwtCapabilitySnapshot(
  role: string,
  row: MembershipAbilityHydrationRow,
): string | undefined {
  return encodeJwtCapabilitySnapshot(resolveEffectiveCapabilitiesFromHydrationRow(role, row));
}
