import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { buildMemberHubPayload } from "@/me/member-hub-bff.server";
import { MemberMoreHubEntitlementGate } from "@/me/member-module-entitlement-gate";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { resolvePortalMemberNavForPlugin } from "@/shell/resolve-portal-member-nav.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { MemberMoreHubList } from "./member-more-hub-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.hub");
  return { title: t("title") };
}

export default async function MeMorePage() {
  const t = await getTranslations("portalMember.hub");
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
        <header data-portal-member-page-header>
          <h1>{t("title")}</h1>
          <p data-portal-member-hub-lede>{t("lede")}</p>
        </header>
        {hubPayload.modules.length === 0 ? (
          <section data-portal-member-hub-empty-state>
            <div data-portal-member-hub-empty-copy>
              <p data-portal-member-hub-empty-eyebrow>{t("title")}</p>
              <h2 data-portal-member-hub-empty-title>{t("emptyTitle")}</h2>
              <p data-portal-member-hub-empty>{t("empty")}</p>
            </div>
          </section>
        ) : (
          <section data-portal-member-hub-section>
            <div data-portal-member-section-heading>
              <p data-portal-member-hub-section-eyebrow>{t("sectionEyebrow")}</p>
              <h2>{t("sectionTitle")}</h2>
              <p>{t("sectionLede")}</p>
            </div>
            <MemberMoreHubList
              mode={hubPayload.presentation.mode}
              items={hubPayload.modules.map((module) => ({
                id: module.id,
                href: module.routePath,
                labelKey: module.labelKey,
                testId: `portal-hub-link-${module.id}`,
              }))}
            />
          </section>
        )}
      </main>
    </MemberMoreHubEntitlementGate>
  );
}
