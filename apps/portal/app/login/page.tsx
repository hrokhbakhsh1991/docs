import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSafePortalReturnPath } from "@app-tour/catalog-registration-flow-ui";
import { isMemberPortalEnabled } from "@app-tour/workspace-sdk";
import {
  resolveMemberLoginCatalogTourId,
  resolvePortalMemberLoginPath,
  resolvePortalMemberModuleUrl,
} from "@app-tour/guest-surface-host";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { PublicCatalogRegistrationFlow } from "@/catalog/public-catalog-registration-flow";
import { PortalAuthExperienceShell } from "@/catalog/portal-auth-experience-shell";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { resolvePortalLoginBackHref } from "@/marketing/resolve-portal-registration-back-href.server";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { sessionMemberMatchesPortalGuestSurface } from "@/tenant/session-host-binding";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly searchParams: Promise<{ readonly portalReturn?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalogRegistration");
  return { title: t("loginPageTitle"), robots: { index: false, follow: false } };
}

export default async function PortalMemberLoginPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);

  if (!isMemberPortalEnabled(bootstrap.pluginId)) {
    notFound();
  }

  const portalReturnRaw = query.portalReturn;
  if (!isSafePortalReturnPath(portalReturnRaw)) {
    const canonical =
      resolvePortalMemberLoginPath(host) ?? "/login?portalReturn=%2Fme%2Fregistrations";
    redirect(canonical);
  }

  const portalReturn = portalReturnRaw.trim();

  const session = await readPublicCatalogSessionFromCookies();
  if (
    session !== null &&
    sessionMemberMatchesPortalGuestSurface(session.tenantId, host, bootstrap.tenantId)
  ) {
    redirect(portalReturn);
  }

  const branding = await fetchPublicTenantBrandingForHost(host);
  const backHref = resolvePortalLoginBackHref(host);
  const memberModuleHref = resolvePortalMemberModuleUrl(host);
  const t = await getTranslations("catalogRegistration");

  const tourId = resolveMemberLoginCatalogTourId(bootstrap.pluginId);
  const tour = await fetchCatalogTour({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    tourId,
  });
  // Member-login egress only needs tourId/title as OTP modal context. Operator smoke
  // (denali plugin + tenant …0014) may lack denali.club login tour …0220 — do not 404.
  const tourTitle =
    tour?.title?.trim() || branding.displayName?.trim() || bootstrap.pluginId || "Tour";
  const workspace = bootstrap.pluginId;

  return (
    <PortalAuthExperienceShell
      branding={branding}
      backHref={backHref}
      heroTitle={t("phone.portalHeroTitle")}
      heroLede={t("phone.portalHeroDescription")}
      sessionBadge={branding.displayName?.trim() || null}
      memberLoginEgress
      pageKind="login"
      workspace={workspace}
      mainAttributes={{
        "data-portal-return": portalReturn,
        "data-portal-login-full-page": "",
      }}
    >
      <div data-portal-login-page-shell>
        <section data-portal-login-story-panel>
          <div data-portal-login-visual aria-hidden="true">
            <span data-portal-login-visual-glow="north" />
            <span data-portal-login-visual-glow="south" />
            <span data-portal-login-visual-orb="primary" />
            <span data-portal-login-visual-orb="secondary" />
            <span data-portal-login-visual-line />
            <span data-portal-login-visual-stop="start" />
            <span data-portal-login-visual-stop="mid" />
            <span data-portal-login-visual-stop="end" />
            <div data-portal-login-visual-card="primary">
              <span data-portal-login-visual-card-title>{t("phone.portalHighlightOne")}</span>
              <span data-portal-login-visual-card-caption>{t("phone.portalHighlightOneCaption")}</span>
            </div>
            <div data-portal-login-visual-card="secondary">
              <span data-portal-login-visual-card-title>{t("phone.portalHighlightTwo")}</span>
              <span data-portal-login-visual-card-caption>{t("phone.portalHighlightTwoCaption")}</span>
            </div>
          </div>
          <div data-portal-login-story-copy>
            <p data-portal-login-story-eyebrow>{t("loginPageTitle")}</p>
            <h2 data-portal-login-story-title>{t("phone.portalStoryTitle")}</h2>
            <p data-portal-login-story-description>{t("phone.portalStoryDescription")}</p>
          </div>
          <div data-portal-login-story-highlights>
            <p data-portal-login-story-highlight>{t("phone.portalAssurance")}</p>
          </div>
        </section>

        <section data-portal-login-form-panel>
          <div data-portal-login-form-panel-header>
            <p data-portal-login-form-panel-eyebrow>{t("phone.formEyebrow")}</p>
            <p data-portal-login-form-panel-description>{t("phone.formDescription")}</p>
          </div>
          <PublicCatalogRegistrationFlow
            workspace={workspace}
            tenantId={bootstrap.tenantId}
            tourId={tourId}
            tourTitle={tourTitle}
            backHref={backHref}
            memberModuleHref={memberModuleHref}
            memberLoginEgress
          />
        </section>
      </div>
    </PortalAuthExperienceShell>
  );
}
