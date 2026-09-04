import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { redirectDeadMemberSession } from "@/me/redirect-dead-member-session.server";
import { fetchMemberTicketCategories } from "@/me/tickets/fetch-member-tickets.server";
import { MemberTicketsDisabled } from "@/me/tickets/member-tickets-disabled";
import { MemberTicketsNewForm } from "@/me/tickets/member-tickets-new-form";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.tickets");
  return { title: t("newTitle") };
}

export default async function MeTicketsNewPage() {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const categoriesResult = await fetchMemberTicketCategories(host);
  const t = await getTranslations("portalMember.tickets");

  if (categoriesResult.status === "unavailable") {
    redirectDeadMemberSession("/me/tickets/new");
  }

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="tickets">
      {categoriesResult.status === "workspace_disabled" ||
      categoriesResult.status === "module_disabled" ? (
        <MemberTicketsDisabled
          reason={
            categoriesResult.status === "module_disabled"
              ? "module_disabled"
              : "workspace_disabled"
          }
        />
      ) : categoriesResult.status !== "ok" ? (
        <MemberTicketsDisabled reason="entitlement_denied" />
      ) : (
        <main data-portal-member-tickets-new>
          <header data-portal-member-page-header>
            <h1>{t("newTitle")}</h1>
            <p>{t("newLede")}</p>
          </header>
          <MemberTicketsNewForm categories={categoriesResult.payload.categories} />
        </main>
      )}
    </MemberModuleEntitlementGate>
  );
}
