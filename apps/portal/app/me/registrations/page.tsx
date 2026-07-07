import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";
import {
  formatMemberRegistrationDeparture,
  localizeMemberPaymentStatus,
  localizeMemberRegistrationStatus,
} from "@/me/format-member-registration-display.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import {
  resolveMemberPortalTripsDetailPath,
} from "@/me/resolve-member-portal-routes.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.registrations");
  return { title: t("title") };
}

export default async function MeRegistrationsPage() {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const items = await fetchMemberRegistrations(host);
  const t = await getTranslations("portalMember.registrations");

  const rows = await Promise.all(
    items.map(async (item) => ({
      item,
      statusLabel: await localizeMemberRegistrationStatus(item.status),
      paymentStatusLabel: await localizeMemberPaymentStatus(item.paymentStatus),
      departureLabel: await formatMemberRegistrationDeparture(item.departureAt),
    }))
  );

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="trips">
      <main data-portal-member-registrations>
        <h1>{t("title")}</h1>
        {rows.length === 0 ? (
          <p data-portal-member-registrations-empty>{t("empty")}</p>
        ) : (
          <ul>
            {rows.map(({ item, statusLabel, paymentStatusLabel, departureLabel }) => (
              <li key={item.id} data-portal-member-registration-row>
                <a href={resolveMemberPortalTripsDetailPath(bootstrap.pluginId, item.id)}>
                  {item.tourTitle}
                </a>
                <p>
                  {t("statusLine", {
                    status: statusLabel,
                    paymentStatus: paymentStatusLabel,
                    departureAt: departureLabel,
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </MemberModuleEntitlementGate>
  );
}
