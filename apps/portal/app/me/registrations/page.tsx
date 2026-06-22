import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

type RegistrationItem = {
  id: string;
  tourTitle: string;
  status: string;
  paymentStatus: string;
  departureAt: string;
};

async function fetchRegistrations(host: string): Promise<RegistrationItem[]> {
  const res = await fetch(`http://${host}/api/me/registrations`, {
    cache: "no-store",
    headers: { host },
  });
  if (!res.ok) {
    return [];
  }
  const payload = (await res.json()) as {
    data?: { items?: RegistrationItem[] };
  };
  return payload.data?.items ?? [];
}

export default async function MeRegistrationsPage() {
  const host = (await headers()).get("host") ?? "localhost:3003";
  const items = await fetchRegistrations(host);
  const t = await getTranslations("portalMember.registrations");

  return (
    <section data-portal-member-registrations>
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border p-4">
              <a href={`/me/registrations/${encodeURIComponent(item.id)}`} className="font-medium">
                {item.tourTitle}
              </a>
              <p className="text-sm text-muted-foreground">
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
    </section>
  );
}
