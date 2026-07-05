import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";
import {
  formatMemberRegistrationDeparture,
  localizeMemberPaymentStatus,
  localizeMemberRegistrationStatus,
} from "@/me/format-member-registration-display.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { MemberReceiptUploadForm } from "./member-receipt-upload-form";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const host = await readPortalIngressHost();
  const items = await fetchMemberRegistrations(host);
  const row = items.find((item) => item.id === id);
  return { title: row?.tourTitle ?? id };
}

export default async function MeRegistrationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const items = await fetchMemberRegistrations(host);
  const row = items.find((item) => item.id === id);
  if (row === undefined) {
    notFound();
  }
  const t = await getTranslations("portalMember.detail");
  const [statusLabel, paymentStatusLabel, departureLabel] = await Promise.all([
    localizeMemberRegistrationStatus(row.status),
    localizeMemberPaymentStatus(row.paymentStatus),
    formatMemberRegistrationDeparture(row.departureAt),
  ]);

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="trips">
      <main data-portal-member-registration-detail>
        <p>
          <Link href="/me/registrations">{t("backToList")}</Link>
        </p>
        <h1>{row.tourTitle}</h1>
        <p data-portal-member-registration-status>
          {t("statusLine", { status: statusLabel, paymentStatus: paymentStatusLabel })}
        </p>
        <p data-portal-member-registration-departure>
          {t("departure", { departureAt: departureLabel })}
        </p>
        <MemberReceiptUploadForm registrationId={row.id} />
      </main>
    </MemberModuleEntitlementGate>
  );
}
