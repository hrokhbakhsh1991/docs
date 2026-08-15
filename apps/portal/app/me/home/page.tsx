import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { buildMemberHomePayload } from "@/me/member-home-bff.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import {
  memberPortalIncludesHomeModule,
  resolveMemberPortalBackTargetPath,
} from "@/me/resolve-member-portal-routes.server";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { MemberHomeQuickLinks } from "./member-home-quick-links";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.home");
  return { title: t("title") };
}

export default async function MeHomePage() {
  const t = await getTranslations("portalMember.home");
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);

  if (!memberPortalIncludesHomeModule(bootstrap.pluginId)) {
    const fallback = resolveMemberPortalBackTargetPath(bootstrap.pluginId);
    redirect(fallback ?? "/");
  }
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
        <header data-portal-member-page-header>
          <h1>{t(homePayload.welcome.titleKey)}</h1>
          <p data-portal-member-home-lede>{t(homePayload.welcome.ledeKey)}</p>
        </header>
        <section data-portal-member-home-quick-links-section>
          <div data-portal-member-section-heading>
            <p data-portal-member-home-section-eyebrow>{t("quickLinksEyebrow")}</p>
            <h2>{t("quickLinksTitle")}</h2>
            <p>{t("quickLinksLede")}</p>
          </div>
          <MemberHomeQuickLinks
            items={quickLinks.map((module) => ({
              id: module.id,
              href: module.routePath,
              labelKey: module.labelKey,
              testId: `portal-home-link-${module.id}`,
            }))}
          />
        </section>
      </main>
    </MemberModuleEntitlementGate>
  );
}
