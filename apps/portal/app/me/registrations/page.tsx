import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";

export default async function MeRegistrationsPage() {
  const host = (await headers()).get("host") ?? "localhost:3003";
  const items = await fetchMemberRegistrations(host);
  const t = await getTranslations("portalMember.registrations");

  return (
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
  );
}
