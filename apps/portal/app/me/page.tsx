import {
  isMemberPortalEnabled,
  tryResolveMemberPortalDefaultRoutePath,
} from "@app-tour/workspace-sdk";
import { redirect } from "next/navigation";

import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { MemberPortalDisabled } from "@/me/member-portal-disabled";

export default async function MePage() {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (!isMemberPortalEnabled(bootstrap.pluginId)) {
    return <MemberPortalDisabled />;
  }
  const routePath = tryResolveMemberPortalDefaultRoutePath(bootstrap.pluginId);
  if (routePath === null) {
    return <MemberPortalDisabled />;
  }
  redirect(routePath);
}
