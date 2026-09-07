import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { fetchMemberReceiptPanel } from "@/me/fetch-member-receipt-status.server";
import { fetchMemberRegistrationById } from "@/me/fetch-member-registration-by-id.server";
import { fetchMemberTourExecutionSummary } from "@/me/fetch-member-tour-execution-summary.server";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { formatMemberRegistrationDeparture,
  localizeMemberPaymentStatus,
  localizeMemberRegistrationStatus,
} from "@/me/format-member-registration-display.server";
import { formatPaymentDueAtForMemberLocale } from "@/me/format-payment-due-at";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { parseRegistrationLifecycleStatus } from "@/me/registration-lifecycle-status";
import { resolveMemberPortalTripsListPath } from "@/me/resolve-member-portal-routes.server";
import { resolveMarketingTourDetailUrl } from "@/marketing/resolve-marketing-public-url";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { registerWorkspaceIntakeSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { resolveIntakeSchema } from "@app-tour/workspace-sdk";

import { MemberIntakeAmendForm } from "./member-intake-amend-form";
import { MemberCancellationPanel } from "./member-cancellation-panel";
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
  const tAmend = await getTranslations("portalMember.intakeAmend");
  const lifecycleStatus = parseRegistrationLifecycleStatus(row.status) ?? "pending";
  const executionSummary =
    lifecycleStatus === "approved" &&
    typeof row.tourId === "string" &&
    row.tourId.trim().length > 0
      ? await fetchMemberTourExecutionSummary(host, row.tourId)
      : null;
  const [statusLabel, paymentStatusLabel, departureLabel, receiptPanel, executionMeetingTimeLabel] =
    await Promise.all([
      localizeMemberRegistrationStatus(row.status, bootstrap.pluginId),
      localizeMemberPaymentStatus(row.paymentStatus),
      formatMemberRegistrationDeparture(row.departureAt),
      fetchMemberReceiptPanel(host, row.id),
      executionSummary?.scheduledMeetingAt
        ? formatMemberRegistrationDeparture(executionSummary.scheduledMeetingAt)
        : Promise.resolve(null),
    ]);

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
  const transportKind =
    row.transportKind === "primary" ||
    row.transportKind === "personal_car" ||
    row.transportKind === "no_car_dong" ||
    row.transportKind === "no_car_acquaintance"
      ? row.transportKind
      : null;
  const transportKindLabel =
    transportKind === "primary"
      ? tAmend("noPersonalCar")
      : transportKind === "personal_car"
        ? tAmend("personalCar")
        : transportKind === "no_car_dong"
          ? tAmend("noCarDong")
          : transportKind === "no_car_acquaintance"
            ? tAmend("noCarAcquaintance")
            : null;
  const personalCarOccupants =
    row.personalCarOccupants === 1 ||
    row.personalCarOccupants === 2 ||
    row.personalCarOccupants === 3
      ? row.personalCarOccupants
      : null;
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
            <span data-portal-member-back-icon aria-hidden="true">
              ←
            </span>
            <span data-portal-member-back-label>{t("backToList")}</span>
          </Link>
        </header>
        <section data-portal-member-detail-hero>
          <div data-portal-member-detail-hero-content>
            <p data-portal-member-detail-eyebrow>{t("summaryEyebrow")}</p>
            <h1>{row.tourTitle}</h1>
            <p data-portal-member-detail-lede>{t("lede")}</p>
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
          </div>
          <div data-portal-member-detail-kpis>
            <div data-portal-member-detail-kpi data-kpi="status">
              <p data-portal-member-detail-kpi-label>{t("statusLabel")}</p>
              <p data-portal-member-registration-status>
                {t("statusLine", { status: statusLabel, paymentStatus: paymentStatusLabel })}
              </p>
            </div>
            <div data-portal-member-detail-kpi data-kpi="departure">
              <p data-portal-member-detail-kpi-label>{t("departureLabel")}</p>
              <p data-portal-member-registration-departure>
                {t("departure", { departureAt: departureLabel })}
              </p>
            </div>
            {transportKind !== null && transportKindLabel !== null ? (
              <div data-portal-member-detail-kpi data-kpi="transport">
                <p data-portal-member-detail-kpi-label>{t("transportLabel")}</p>
                <p
                  data-portal-member-registration-transport
                  data-transport-kind={transportKind}
                >
                  {transportKind === "personal_car" && personalCarOccupants !== null
                    ? t("transportLineOccupants", {
                        kind: transportKindLabel,
                        occupants: personalCarOccupants,
                      })
                    : transportKindLabel}
                </p>
              </div>
            ) : null}
            {typeof row.paymentDueAt === "string" && row.paymentDueAt.length > 0 ? (
              <div data-portal-member-detail-kpi data-kpi="payment-due">
                <p data-portal-member-detail-kpi-label>{t("paymentDueLabel")}</p>
                <p data-portal-member-payment-due-at data-portal-member-payment-countdown>
                  {formatPaymentDueAtForMemberLocale(row.paymentDueAt)}
                </p>
              </div>
            ) : null}
          </div>
        </section>
        {executionSummary !== null ? (
          <section
            data-portal-member-execution-summary
            data-ito-execution-state={executionSummary.state}
          >
            <h2>{t("executionTitle")}</h2>
            <p data-ito-member-execution-state>
              {t("executionStateLabel")}:{" "}
              {t(`executionStates.${executionSummary.state}` as "executionStates.draft")}
            </p>
            {executionSummary.tourLeaderDisplayName ? (
              <p data-ito-member-tour-leader>
                {t("executionTourLeaderLabel")}: {executionSummary.tourLeaderDisplayName}
              </p>
            ) : null}
            {executionMeetingTimeLabel ? (
              <p data-ito-member-meeting-time>
                {t("executionMeetingTimeLabel")}: {executionMeetingTimeLabel}
              </p>
            ) : null}
            {executionSummary.meetingLocation ? (
              <p data-ito-member-meeting-location>
                {t("executionMeetingLocationLabel")}: {executionSummary.meetingLocation}
              </p>
            ) : null}
          </section>
        ) : null}
        {showIntakeAmend && tour !== null ? (
          <MemberIntakeAmendForm
            registrationId={row.id}
            allowPersonalCar={tour.transport?.allowPersonalCar === true}
            sharedCarsMode={tour.transport?.mode === "shared_cars"}
            dongAvailable={
              typeof tour.transport?.dongAmount === "number" && tour.transport.dongAmount > 0
            }
            {...(transportKind !== null ? { initialKind: transportKind } : {})}
            {...(personalCarOccupants !== null ? { initialOccupants: personalCarOccupants } : {})}
          />
        ) : null}
        <MemberCancellationPanel
          registrationId={row.id}
          registrationStatus={lifecycleStatus}
        />
        <MemberReceiptUploadForm
          registrationId={row.id}
          registrationStatus={lifecycleStatus}
          initialPanel={receiptPanel}
          tripsListHref={tripsListHref}
          tourHref={tourHref}
          catalogDue={
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
          cancelSource={row.cancelSource ?? null}
        />
      </main>
    </MemberModuleEntitlementGate>
  );
}
