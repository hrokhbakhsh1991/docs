import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buildMemberHubPayload, type MemberHubPayload } from "@/me/member-hub-bff.server";
import { MemberMoreHubEntitlementGate } from "@/me/member-module-entitlement-gate";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { resolvePortalMemberNavForPlugin } from "@/shell/resolve-portal-member-nav.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

function HubModuleList({
  payload,
  labelForKey,
}: {
  readonly payload: MemberHubPayload;
  readonly labelForKey: (labelKey: string) => string;
}) {
  const listClassName =
    payload.presentation.mode === "virtualised"
      ? "max-h-[min(70dvh,32rem)] overflow-y-auto overscroll-contain"
      : undefined;

  return (
    <ul
      data-portal-member-hub-list
      data-portal-member-hub-mode={payload.presentation.mode}
      className={listClassName}
    >
      {payload.modules.map((module) => (
        <li key={module.id}>
          <Link href={module.routePath} data-testid={`portal-hub-link-${module.id}`}>
            {labelForKey(module.labelKey)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.hub");
  return { title: t("title") };
}

export default async function MeMorePage() {
  const t = await getTranslations("portalMember.hub");
  const tNav = await getTranslations("portalMember.nav");
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  const granted = entitlements?.granted ?? [];
  const { hubNav } = resolvePortalMemberNavForPlugin(bootstrap.pluginId, granted);
  const hubPayload = buildMemberHubPayload({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    hubNav,
  });

  return (
    <MemberMoreHubEntitlementGate host={host} bootstrap={bootstrap}>
      <main data-portal-member-more>
        <h1>{t("title")}</h1>
        {hubPayload.modules.length === 0 ? (
          <p data-portal-member-hub-empty>{t("empty")}</p>
        ) : (
          <HubModuleList payload={hubPayload} labelForKey={(key) => tNav(key)} />
        )}
      </main>
    </MemberMoreHubEntitlementGate>
  );
}
