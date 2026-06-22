import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";

import { MemberReceiptUploadForm } from "./member-receipt-upload-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function MeRegistrationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const host = (await headers()).get("host") ?? "localhost:3003";
  const items = await fetchMemberRegistrations(host);
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
