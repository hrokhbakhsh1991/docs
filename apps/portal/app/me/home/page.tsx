import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buildMemberHomePayload } from "@/me/member-home-bff.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.home");
  return { title: t("title") };
}

export default async function MeHomePage() {
  const t = await getTranslations("portalMember.home");
  const tNav = await getTranslations("portalMember.nav");
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  const homePayload = buildMemberHomePayload({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    grantedEntitlementKeys: entitlements?.granted ?? [],
  });

  const quickLinks = homePayload.modules.filter(
    (module) => module.entitled && module.id !== "home"
  );

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="home">
      <main data-portal-member-home>
        <h1>{t(homePayload.welcome.titleKey)}</h1>
        <p data-portal-member-home-lede>{t(homePayload.welcome.ledeKey)}</p>
        {quickLinks.length > 0 ? (
          <ul data-portal-member-home-quick-links>
            {quickLinks.map((module) => (
              <li key={module.id}>
                <Link href={module.routePath} data-testid={`portal-home-link-${module.id}`}>
                  {tNav(module.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </MemberModuleEntitlementGate>
  );
}
