import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { buildMemberHomePayload } from "@/me/member-home-bff.server";
import { fetchMemberEngagementSummary } from "@/me/engagement/member-engagement-bff.server";
import { resolveMemberDashboardWalletSummary } from "@/me/wallet/member-dashboard-wallet-summary.server";
import { fetchMemberProfileFromSession } from "@/me/fetch-member-profile-from-session.server";
import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import {
  memberPortalIncludesHomeModule,
  resolveMemberPortalEngagementPath,
  resolveMemberPortalBackTargetPath,
  resolveMemberPortalTripsListPath,
  resolveMemberPortalWalletPath,
} from "@/me/resolve-member-portal-routes.server";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { MemberHomeQuickLinks } from "./member-home-quick-links";
import { MemberDashboardEngagementPanel } from "./member-dashboard-engagement-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.home");
  return { title: t("title") };
}

function resolveNextTour(
  registrations: Awaited<ReturnType<typeof fetchMemberRegistrations>>,
): { readonly title: string | null; readonly departureAt: string | null } {
  const upcoming = registrations
    .filter((item) => item.status === "approved" || item.status === "pending")
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  const next = upcoming[0];
  if (next === undefined) {
    return { title: null, departureAt: null };
  }
  return { title: next.tourTitle, departureAt: next.departureAt };
}

export default async function MeHomePage() {
  const t = await getTranslations("portalMember.home");
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const engagementHref = resolveMemberPortalEngagementPath(bootstrap.pluginId);
  const registrationsHref = resolveMemberPortalTripsListPath(bootstrap.pluginId);
  const walletHref = resolveMemberPortalWalletPath(bootstrap.pluginId);

  if (!memberPortalIncludesHomeModule(bootstrap.pluginId)) {
    const fallback = resolveMemberPortalBackTargetPath(bootstrap.pluginId);
    redirect(fallback ?? "/");
  }
  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  const homePayload = buildMemberHomePayload({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    grantedEntitlementKeys: entitlements?.payload.granted ?? [],
  });

  const quickLinks = homePayload.modules.filter(
    (module) => module.entitled && module.id !== "home",
  );

  const [engagementResult, registrations, profile, walletSummary] = await Promise.all([
    fetchMemberEngagementSummary(host),
    fetchMemberRegistrations(host),
    fetchMemberProfileFromSession(host, bootstrap.tenantId),
    resolveMemberDashboardWalletSummary({
      host,
      grantedEntitlementKeys: entitlements?.payload.granted ?? [],
    }),
  ]);

  const engagementView =
    engagementResult.ok && "enabled" in engagementResult.view && engagementResult.view.enabled
      ? engagementResult.view
      : { enabled: false as const };

  const nextTour = resolveNextTour(registrations);
  const profileComplete =
    profile !== null &&
    Boolean(profile.profile.fields.displayName?.trim()) &&
    Boolean(profile.profile.fields.email?.trim()) &&
    profile.profile.fields.gender !== null &&
    Boolean(profile.profile.fields.nationalId?.trim()) &&
    Boolean(profile.profile.fields.fatherName?.trim()) &&
    Boolean(profile.profile.fields.birthDate?.trim());

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="home">
      <main data-portal-member-home>
        <header data-portal-member-page-header>
          <h1>{t(homePayload.welcome.titleKey)}</h1>
          <p data-portal-member-home-lede>{t(homePayload.welcome.ledeKey)}</p>
        </header>

        <MemberDashboardEngagementPanel
          engagement={engagementView}
          wallet={walletSummary}
          openTicketsCount={null}
          nextTourTitle={nextTour.title}
          nextTourDepartureAt={nextTour.departureAt}
          profileComplete={profileComplete}
          engagementHref={engagementHref}
          registrationsHref={registrationsHref}
          walletHref={walletHref}
        />

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
