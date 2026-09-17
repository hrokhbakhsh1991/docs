import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  evaluateMemberPortalEntitlements,
  memberPortalEntitlementKey,
} from "@app-tour/workspace-sdk";

export const FORBIDDEN_MEMBER_MODULE_WALLET = "FORBIDDEN_MEMBER_MODULE_WALLET" as const;

function isActiveMember(auth: TenantAuthContext): boolean {
  return (
    auth.role === "member" &&
    auth.status === "ACTIVE" &&
    auth.workspaceId !== undefined &&
    auth.workspaceId.length > 0
  );
}

/**
 * Member wallet read entitlement — requires `member.module.wallet` grant.
 */
export function assertWalletMemberEntitlement(
  auth: TenantAuthContext,
  workspaceType: string,
  theme: unknown,
): void {
  if (!isActiveMember(auth)) {
    throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
  }

  const themeRecord =
    theme !== null && typeof theme === "object" && !Array.isArray(theme)
      ? (theme as { portalModuleGrants?: unknown })
      : {};
  const explicitModuleIds = Array.isArray(themeRecord.portalModuleGrants)
    ? themeRecord.portalModuleGrants.filter((id): id is string => typeof id === "string")
    : undefined;

  const evaluation = evaluateMemberPortalEntitlements(workspaceType, {
    ...(explicitModuleIds !== undefined ? { explicitModuleIds } : {}),
  });
  const walletKey = memberPortalEntitlementKey("wallet");
  if (!evaluation.granted.includes(walletKey)) {
    throw new Error(FORBIDDEN_MEMBER_MODULE_WALLET);
  }
}
