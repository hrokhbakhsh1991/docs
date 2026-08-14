import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { fetchMemberReceiptStatus } from "@/me/fetch-member-receipt-status.server";
import { fetchMemberRegistrationById } from "@/me/fetch-member-registration-by-id.server";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import {
  formatMemberRegistrationDeparture,
  localizeMemberPaymentStatus,
  localizeMemberRegistrationStatus,
} from "@/me/format-member-registration-display.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { MemberRegistrationJourneySummary } from "@/me/member-registration-journey-summary";
import { parseRegistrationLifecycleStatus } from "@/me/registration-lifecycle-status";
import { resolveMemberPortalTripsListPath } from "@/me/resolve-member-portal-routes.server";
import { resolveMarketingTourDetailUrl } from "@/marketing/resolve-marketing-public-url";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { registerWorkspaceIntakeSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { resolveIntakeSchema } from "@app-tour/workspace-sdk";

import { MemberIntakeAmendForm } from "./member-intake-amend-form";
import { MemberReceiptUploadForm } from "./member-receipt-upload-form";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const host = await readPortalIngressHost();
  const row = await fetchMemberRegistrationById(host, id);
  return { title: row?.tourTitle ?? id };
}

export default async function MeRegistrationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const row = await fetchMemberRegistrationById(host, id);
  if (row === null) {
    notFound();
  }
  const t = await getTranslations("portalMember.detail");
  const tJourney = await getTranslations("portalMember.registrationJourneyLabels");
  const tJourneyHint = await getTranslations("portalMember.registrationJourneyHints");
  const [statusLabel, paymentStatusLabel, departureLabel, receiptStatus] = await Promise.all([
    localizeMemberRegistrationStatus(row.status),
    localizeMemberPaymentStatus(row.paymentStatus),
    formatMemberRegistrationDeparture(row.departureAt),
    fetchMemberReceiptStatus(host, row.id),
  ]);

  const lifecycleStatus = parseRegistrationLifecycleStatus(row.status) ?? "pending";
  bindWorkspacePluginRegisterInvokers();
  await registerWorkspaceIntakeSafe(bootstrap.pluginId);
  const intakeFeatures = resolveIntakeSchema(bootstrap.pluginId).features;
  const showIntakeAmend =
    intakeFeatures.memberPendingIntakeAmend === true &&
    (lifecycleStatus === "pending" || lifecycleStatus === "waitlisted");

  const tour =
    showIntakeAmend && typeof row.tourId === "string" && row.tourId.trim().length > 0
      ? await fetchCatalogTour({
          tenantId: bootstrap.tenantId,
          pluginId: bootstrap.pluginId,
          tourId: row.tourId,
        })
      : null;

  const tripsListHref = resolveMemberPortalTripsListPath(bootstrap.pluginId);
  const tourHref =
    typeof row.tourId === "string" && row.tourId.trim().length > 0
      ? resolveMarketingTourDetailUrl(host, row.tourId)
      : null;
  const registrantTarget = row.registrantTarget === "other" ? "other" : "self";
  const guestLabel =
    typeof row.guestLabel === "string" && row.guestLabel.trim().length > 0
      ? row.guestLabel.trim()
      : null;

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="trips">
      <main
        data-portal-member-registration-detail
        data-portal-member-registrant-target={registrantTarget}
      >
        <header data-portal-member-detail-app-bar>
          <Link href={tripsListHref} data-portal-member-back>
            {t("backToList")}
          </Link>
        </header>
        <section data-portal-member-detail-hero>
          <h1>{row.tourTitle}</h1>
          {registrantTarget === "other" ? (
            <p data-portal-member-registration-guest>
              <span data-portal-member-registrant-other-badge>{t("forOtherBadge")}</span>
              {guestLabel !== null ? (
                <span data-portal-member-registration-guest-label>
                  {t("guestLine", { guestLabel })}
                </span>
              ) : null}
            </p>
          ) : null}
          <p data-portal-member-registration-status>
            {t("statusLine", { status: statusLabel, paymentStatus: paymentStatusLabel })}
          </p>
          <MemberRegistrationJourneySummary
            status={row.status}
            paymentStatus={row.paymentStatus}
            translateLabel={(key) => tJourney(key)}
            translateHint={(key) => tJourneyHint(key)}
          />
          <p data-portal-member-registration-departure>
            {t("departure", { departureAt: departureLabel })}
          </p>
        </section>
        {showIntakeAmend && tour !== null ? (
          <MemberIntakeAmendForm
            registrationId={row.id}
            allowPersonalCar={tour.transport?.allowPersonalCar === true}
            sharedCarsMode={tour.transport?.mode === "shared_cars"}
            dongAvailable={
              typeof tour.transport?.dongAmount === "number" && tour.transport.dongAmount > 0
            }
          />
        ) : null}
        <MemberReceiptUploadForm
          registrationId={row.id}
          registrationStatus={lifecycleStatus}
          initialStatus={row.paymentStatus === "paid" ? "paid" : receiptStatus}
          tripsListHref={tripsListHref}
          tourHref={tourHref}
          due={
            typeof row.dueTotalMinor === "string" &&
            row.dueTotalMinor.length > 0 &&
            typeof row.dueCurrency === "string" &&
            row.dueCurrency.length > 0
              ? {
                  currency: row.dueCurrency,
                  totalMinor: row.dueTotalMinor,
                  lines: row.dueLines ?? [],
                }
              : null
          }
        />
      </main>
    </MemberModuleEntitlementGate>
  );
}
