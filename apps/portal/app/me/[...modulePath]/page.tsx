import { notFound } from "next/navigation";

import {
  MemberPortalUnknownRouteError,
  resolveMemberPortalModuleByRoutePath,
} from "@app-tour/workspace-sdk";

import { isMemberModuleEntitled } from "@/me/member-module-entitlement-gate";
import { MemberModuleStub } from "@/me/member-module-stub";
import { MemberModuleUnauthorized } from "@/me/member-module-unauthorized";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

type MemberModuleDispatcherPageProps = {
  readonly params: Promise<{ readonly modulePath: string[] }>;
};

/** PS-5 catch-all — static app/me routes win over dispatcher (DL-28). */
export default async function MemberModuleDispatcherPage({
  params,
}: MemberModuleDispatcherPageProps) {
  const { modulePath } = await params;
  const routePath = `/me/${modulePath.join("/")}`;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);

  let moduleManifest;
  try {
    moduleManifest = resolveMemberPortalModuleByRoutePath(bootstrap.pluginId, routePath);
  } catch (error) {
    if (error instanceof MemberPortalUnknownRouteError) {
      notFound();
    }
    throw error;
  }

  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  const grantedEntitlementKeys = entitlements?.granted ?? [];
  if (!isMemberModuleEntitled(moduleManifest.id, grantedEntitlementKeys)) {
    return <MemberModuleUnauthorized moduleId={moduleManifest.id} />;
  }

  return (
    <MemberModuleStub
      pluginId={bootstrap.pluginId}
      moduleId={moduleManifest.id}
      labelKey={moduleManifest.nav.labelKey}
      routePath={moduleManifest.routePath}
    />
  );
}
