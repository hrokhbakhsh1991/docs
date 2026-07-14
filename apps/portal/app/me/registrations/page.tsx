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
import { resolveMarketingToursUrl } from "@/marketing/resolve-marketing-public-url";
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
  const browseToursUrl = resolveMarketingToursUrl(host);

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="trips">
      <main data-portal-member-registrations>
        <header data-portal-member-page-header>
          <h1>{t("title")}</h1>
        </header>
        {rows.length === 0 ? (
          <div data-portal-member-registrations-empty-state>
            <p data-portal-member-registrations-empty>{t("empty")}</p>
            <a href={browseToursUrl} data-portal-member-registrations-empty-cta>
              {t("emptyCta")}
            </a>
          </div>
        ) : (
          <ul data-portal-member-registrations-list>
            {rows.map(({ item, statusLabel, paymentStatusLabel, departureLabel }) => (
              <li key={item.id} data-portal-member-registration-row>
                <div data-portal-member-registration-row-header>
                  <a href={resolveMemberPortalTripsDetailPath(bootstrap.pluginId, item.id)}>
                    {item.tourTitle}
                  </a>
                  <span
                    data-portal-member-registration-status-badge
                    data-status={item.status}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p data-portal-member-registration-meta>
                  <span data-portal-member-registration-payment-status>
                    {paymentStatusLabel}
                  </span>
                  <span data-portal-member-registration-departure>{departureLabel}</span>
                </p>
                <span data-portal-member-row-chevron aria-hidden="true">
                  ›
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </MemberModuleEntitlementGate>
  );
}
