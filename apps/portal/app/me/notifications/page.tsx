import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MemberNotificationsPanel } from "@/me/notifications/member-ticket-notifications-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.notifications");
  return { title: t("title") };
}

export default async function MemberNotificationsPage() {
  const t = await getTranslations("portalMember.notifications");

  return (
    <main data-portal-member-notifications data-portal-member-notifications-state="ready">
      <header data-portal-member-page-header>
        <h1>{t("title")}</h1>
        <p data-portal-member-notifications-lede>{t("lede")}</p>
      </header>
      <MemberNotificationsPanel />
    </main>
  );
}
