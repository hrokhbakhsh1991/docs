import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { MemberReceiptUploadForm } from "./member-receipt-upload-form";

type RegistrationItem = {
  id: string;
  tourTitle: string;
  status: string;
  paymentStatus: string;
  departureAt: string;
  submittedAt: string;
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

type PageProps = { params: Promise<{ id: string }> };

export default async function MeRegistrationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const host = (await headers()).get("host") ?? "localhost:3003";
  const items = await fetchRegistrations(host);
  const row = items.find((item) => item.id === id);
  if (row === undefined) {
    notFound();
  }
  const t = await getTranslations("portalMember.detail");

  return (
    <section data-portal-member-registration-detail>
      <h1 className="mb-2 text-xl font-semibold">{row.tourTitle}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("statusLine", { status: row.status, paymentStatus: row.paymentStatus })}
      </p>
      <p className="mb-6 text-sm">{t("departure", { departureAt: row.departureAt })}</p>
      <MemberReceiptUploadForm registrationId={row.id} />
    </section>
  );
}
