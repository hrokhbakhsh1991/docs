import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSafePortalReturnPath } from "@app-tour/catalog-registration-flow-ui";
import { supportsCatalogRegistration } from "@app-tour/workspace-sdk";
import {
  resolveMemberLoginCatalogTourId,
  resolvePortalMemberModuleUrl,
} from "@app-tour/guest-surface-host";
import { registerWorkspacePluginSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";

import { PortalLoginModalOpener } from "@/auth/portal-login-modal-opener";
import { PortalRegisterGuestAuthGate } from "@/auth/portal-register-guest-auth-gate";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { PublicCatalogRegistrationFlow } from "@/catalog/public-catalog-registration-flow";
import { resolvePortalRegistrationBackHref } from "@/marketing/resolve-portal-registration-back-href.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { PortalAuthExperienceShell } from "@/catalog/portal-auth-experience-shell";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { sessionMemberMatchesPortalGuestSurface } from "@/tenant/session-host-binding";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
  readonly searchParams: Promise<{ readonly portalReturn?: string; readonly auth?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { tourId } = await params;
  const query = await searchParams;
  if (isSafePortalReturnPath(query.portalReturn)) {
    redirect(`/login?portalReturn=${encodeURIComponent(query.portalReturn!.trim())}`);
  }
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const t = await getTranslations("catalogRegistration");

  if (!supportsCatalogRegistration(bootstrap.pluginId)) {
    return {
      title: t("pageTitle", { tourTitle: tourId }),
      robots: { index: false, follow: false },
    };
  }

  const tour = await fetchCatalogTour({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    tourId,
  });

  return {
    title: t("pageTitle", { tourTitle: tour?.title ?? tourId }),
    robots: { index: false, follow: false },
  };
}

export default async function CatalogRegisterPage({ params, searchParams }: PageProps) {
  const { tourId } = await params;
  const query = await searchParams;
  if (isSafePortalReturnPath(query.portalReturn)) {
    redirect(`/login?portalReturn=${encodeURIComponent(query.portalReturn!.trim())}`);
  }
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const backHref = resolvePortalRegistrationBackHref(host, tourId);
  const memberModuleHref = resolvePortalMemberModuleUrl(host);
  const branding = await fetchPublicTenantBrandingForHost(host);
  const t = await getTranslations("catalogRegistration");

  if (!supportsCatalogRegistration(bootstrap.pluginId)) {
    notFound();
  }

  bindWorkspacePluginRegisterInvokers();
  await registerWorkspacePluginSafe(bootstrap.pluginId);

  const tour = await fetchCatalogTour({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    tourId,
  });
  if (tour === null) {
    notFound();
  }

  const tourTitle = tour.title || "Tour";
  const workspace = bootstrap.pluginId;

  const session = await readPublicCatalogSessionFromCookies();
  const resumeAtIntake =
    session !== null &&
    sessionMemberMatchesPortalGuestSurface(session.tenantId, host, bootstrap.tenantId);
  // PCMS-UX-MODAL-04 — guests auth in modal only; page is intake after session.
  const heroLede = resumeAtIntake ? null : t("phone.loginDescription");
  const heroKicker = resumeAtIntake ? t("intake.kicker") : null;
  const sessionBadge = null;

  const loginFlow = {
    workspace,
    tenantId: bootstrap.tenantId,
    tourId: resolveMemberLoginCatalogTourId(bootstrap.pluginId),
    tourTitle,
    backHref,
    memberModuleHref,
  };

  return (
    <PortalAuthExperienceShell
      branding={branding}
      backHref={backHref}
      heroTitle={resumeAtIntake ? tourTitle : t("pageTitle", { tourTitle })}
      heroKicker={heroKicker}
      heroLede={heroLede}
      sessionBadge={sessionBadge}
      pageKind="registration"
      workspace={workspace}
      mainAttributes={
        resumeAtIntake
          ? { "data-registration-resume": "intake" }
          : { "data-portal-register-guest-auth": "modal-first" }
      }
    >
      {resumeAtIntake ? (
        <PublicCatalogRegistrationFlow
          workspace={workspace}
          tenantId={bootstrap.tenantId}
          tourId={tourId}
          tourTitle={tourTitle}
          tourPoliciesText={tour.policiesText ?? null}
          tourPriceAmount={tour.priceAmount ?? null}
          tourTransport={tour.transport}
          tourNationalIdRequired={tour.nationalIdRequired === true}
          tourFatherNameRequired={tour.fatherNameRequired === true}
          tourBirthDateRequired={tour.birthDateRequired === true}
          backHref={backHref}
          memberModuleHref={memberModuleHref}
        />
      ) : (
        <>
          {/* PCMS-UX-MODAL-04: guests always auto-open; `?auth=login` is a compatible deep link. */}
          <PortalLoginModalOpener flow={loginFlow} />
          <PortalRegisterGuestAuthGate flow={loginFlow} tenantId={bootstrap.tenantId} />
        </>
      )}
    </PortalAuthExperienceShell>
  );
}
