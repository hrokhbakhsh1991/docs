import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";
import {
  formatMemberRegistrationDeparture,
  localizeMemberPaymentStatus,
  localizeMemberRegistrationStatus,
} from "@/me/format-member-registration-display.server";
import { MemberRegistrationJourneySummary } from "@/me/member-registration-journey-summary";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import {
  resolveMemberPortalTripsDetailPath,
} from "@/me/resolve-member-portal-routes.server";
import { resolveMarketingToursUrl } from "@/marketing/resolve-marketing-public-url";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export type RegistrantListFilter = "all" | "self" | "other";

function parseRegistrantListFilter(raw: string | string[] | undefined): RegistrantListFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "self" || value === "other") {
    return value;
  }
  return "all";
}

function registrantListHref(filter: RegistrantListFilter): string {
  return filter === "all" ? "/me/registrations" : `/me/registrations?target=${filter}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.registrations");
  return { title: t("title") };
}

export default async function MeRegistrationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly target?: string | string[] }>;
}) {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const items = await fetchMemberRegistrations(host);
  const t = await getTranslations("portalMember.registrations");
  const tJourney = await getTranslations("portalMember.registrationJourneyLabels");
  const params = await searchParams;
  const activeFilter = parseRegistrantListFilter(params.target);

  const rows = await Promise.all(
    items.map(async (item) => {
      const registrantTarget = item.registrantTarget === "other" ? "other" : "self";
      const guestLabel =
        typeof item.guestLabel === "string" && item.guestLabel.trim().length > 0
          ? item.guestLabel.trim()
          : null;
      return {
        item,
        registrantTarget,
        guestLabel,
        statusLabel: await localizeMemberRegistrationStatus(item.status),
        paymentStatusLabel: await localizeMemberPaymentStatus(item.paymentStatus),
        departureLabel: await formatMemberRegistrationDeparture(item.departureAt),
      };
    })
  );

  const selfCount = rows.filter((row) => row.registrantTarget === "self").length;
  const otherCount = rows.filter((row) => row.registrantTarget === "other").length;
  const allCount = rows.length;
  const visibleRows =
    activeFilter === "all"
      ? rows
      : rows.filter((row) => row.registrantTarget === activeFilter);

  const browseToursUrl = resolveMarketingToursUrl(host);
  const filterTabs: readonly {
    readonly target: RegistrantListFilter;
    readonly label: string;
    readonly count: number;
  }[] = [
    { target: "all", label: t("filterAll"), count: allCount },
    { target: "self", label: t("filterSelf"), count: selfCount },
    { target: "other", label: t("filterOther"), count: otherCount },
  ];

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="trips">
      <main
        data-portal-member-registrations
        data-registrant-filter={activeFilter}
      >
        <header data-portal-member-page-header>
          <h1>{t("title")}</h1>
        </header>

        {allCount > 0 ? (
          <nav
            data-portal-member-registrations-filter
            data-active-target={activeFilter}
            aria-label={t("filterAria")}
          >
            {filterTabs.map(({ target, label, count }) => {
              const active = target === activeFilter;
              return (
                <a
                  key={target}
                  href={registrantListHref(target)}
                  data-portal-member-registrations-filter-tab
                  data-target={target}
                  {...(active ? { "aria-current": "page" as const } : {})}
                >
                  <span data-portal-member-registrations-filter-label>{label}</span>
                  <span data-portal-member-registrations-filter-count>{count}</span>
                </a>
              );
            })}
          </nav>
        ) : null}

        {allCount === 0 ? (
          <div data-portal-member-registrations-empty-state>
            <p data-portal-member-registrations-empty>{t("empty")}</p>
            <a href={browseToursUrl} data-portal-member-registrations-empty-cta>
              {t("emptyCta")}
            </a>
          </div>
        ) : visibleRows.length === 0 ? (
          <div
            data-portal-member-registrations-empty-state
            data-empty-reason="filtered"
          >
            <p data-portal-member-registrations-empty>{t("emptyFiltered")}</p>
          </div>
        ) : (
          <ul data-portal-member-registrations-list>
            {visibleRows.map(
              ({
                item,
                registrantTarget,
                guestLabel,
                statusLabel,
                paymentStatusLabel,
                departureLabel,
              }) => (
                <li
                  key={item.id}
                  data-portal-member-registration-row
                  data-portal-member-registrant-target={registrantTarget}
                >
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
                  {registrantTarget === "other" ? (
                    <p data-portal-member-registration-guest>
                      <span data-portal-member-registrant-other-badge>
                        {t("forOtherBadge")}
                      </span>
                      {guestLabel !== null ? (
                        <span data-portal-member-registration-guest-label>
                          {t("guestLine", { guestLabel })}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p data-portal-member-registration-guest>
                      <span data-portal-member-registrant-self-badge>
                        {t("forSelfBadge")}
                      </span>
                    </p>
                  )}
                  <p data-portal-member-registration-meta>
                    <span data-portal-member-registration-payment-status>
                      {paymentStatusLabel}
                    </span>
                    <span data-portal-member-registration-departure>{departureLabel}</span>
                  </p>
                  <MemberRegistrationJourneySummary
                    status={item.status}
                    paymentStatus={item.paymentStatus}
                    translateLabel={(key) => tJourney(key)}
                  />
                  <span data-portal-member-row-chevron aria-hidden="true">
                    ›
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </main>
    </MemberModuleEntitlementGate>
  );
}
