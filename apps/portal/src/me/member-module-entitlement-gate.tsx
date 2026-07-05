import type { ReactNode } from "react";

import { memberPortalEntitlementKey } from "@app-tour/workspace-sdk";

import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { MemberModuleUnauthorized } from "@/me/member-module-unauthorized";
import { resolvePortalMemberNavForPlugin } from "@/shell/resolve-portal-member-nav.server";

export function isMemberModuleEntitled(
  moduleId: string,
  grantedEntitlementKeys: readonly string[]
): boolean {
  return grantedEntitlementKeys.includes(memberPortalEntitlementKey(moduleId));
}

/** DL-21 — static routes + dispatcher share entitlement gate (PS-6). */
export async function MemberModuleEntitlementGate({
  host,
  bootstrap,
  moduleId,
  children,
}: {
  readonly host: string;
  readonly bootstrap: { readonly tenantId: string; readonly pluginId: string };
  readonly moduleId: string;
  readonly children: ReactNode;
}) {
  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  if (!isMemberModuleEntitled(moduleId, entitlements?.granted ?? [])) {
    return <MemberModuleUnauthorized moduleId={moduleId} />;
  }
  return <>{children}</>;
}

/** DL-21 — More hub requires at least one entitled secondary module (PS-6). */
export async function MemberMoreHubEntitlementGate({
  host,
  bootstrap,
  children,
}: {
  readonly host: string;
  readonly bootstrap: { readonly tenantId: string; readonly pluginId: string };
  readonly children: ReactNode;
}) {
  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  const granted = entitlements?.granted ?? [];
  const { hubNav } = resolvePortalMemberNavForPlugin(bootstrap.pluginId, granted);
  if (hubNav.length === 0) {
    return <MemberModuleUnauthorized moduleId="more" />;
  }
  return <>{children}</>;
}
