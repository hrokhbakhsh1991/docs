import {
  capabilitiesForTenantModules,
  resolveEffectiveCapabilities,
  tryParseWorkspaceRole,
  WorkspaceRole,
  type AppAbility,
  type CapabilityGrantContext,
} from "@repo/shared";

import type { AuthUser } from "@/lib/auth/auth-context";

export function financeGrantContextFromUser(
  user: Pick<AuthUser, "role" | "tenantModules" | "capabilities"> | null | undefined,
): CapabilityGrantContext | null {
  if (!user?.role?.trim()) {
    return null;
  }
  return {
    role: user.role.trim(),
    tenantModules: user.tenantModules,
    capabilities: user.capabilities,
  };
}

/** Mirrors API `@RequireCapability('module.finance')` using tenant modules + grants. */
export function userHasFinanceModuleCapability(
  user: Pick<AuthUser, "role" | "tenantModules" | "capabilities"> | null | undefined,
): boolean {
  const ctx = financeGrantContextFromUser(user);
  if (!ctx) {
    return false;
  }
  return resolveEffectiveCapabilities(ctx).includes("module.finance");
}

export function canAccessFinanceManualPayments(ability: AppAbility): boolean {
  return ability.can("read", "FinanceManualPayment");
}

export function canUploadFinanceReceipts(ability: AppAbility): boolean {
  return ability.can("create", "FinanceReceipt");
}

export function canReviewFinanceReceipts(
  ability: AppAbility,
  user: Pick<AuthUser, "role" | "tenantModules" | "capabilities"> | null | undefined,
): boolean {
  if (!userHasFinanceModuleCapability(user)) {
    return false;
  }
  return ability.can("update", "FinanceReceiptReview");
}

/** @deprecated Prefer {@link canAccessFinanceManualPayments} with CASL ability. */
export function tenantModulesIncludeFinance(
  tenantModules: readonly string[] | null | undefined,
): boolean {
  return capabilitiesForTenantModules(tenantModules).includes("module.finance");
}

export function isFinanceAdminRole(role: string | undefined): boolean {
  const parsed = tryParseWorkspaceRole(role ?? "");
  return parsed === WorkspaceRole.Owner || parsed === WorkspaceRole.Admin;
}
