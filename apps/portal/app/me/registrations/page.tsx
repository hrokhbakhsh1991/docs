import { getTranslations } from "next-intl/server";

import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export default async function MeRegistrationsPage() {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const items = await fetchMemberRegistrations(host);
  const t = await getTranslations("portalMember.registrations");

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="trips">
      <main data-portal-member-registrations>
        <h1>{t("title")}</h1>
        {items.length === 0 ? (
          <p data-portal-member-registrations-empty>{t("empty")}</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id} data-portal-member-registration-row>
                <a href={`/me/registrations/${encodeURIComponent(item.id)}`}>{item.tourTitle}</a>
                <p>
                  {t("statusLine", {
                    status: item.status,
                    paymentStatus: item.paymentStatus,
                    departureAt: item.departureAt,
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
