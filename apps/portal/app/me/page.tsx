import { redirect } from "next/navigation";

import { resolveMemberPortalDefaultRoutePath } from "@app-tour/workspace-sdk";

import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export default async function MePage() {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  redirect(resolveMemberPortalDefaultRoutePath(bootstrap.pluginId));
}
