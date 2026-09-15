import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { redirectDeadMemberSession } from "@/me/redirect-dead-member-session.server";
import { fetchMemberTicketsList } from "@/me/tickets/fetch-member-tickets.server";
import { MemberTicketsDisabled } from "@/me/tickets/member-tickets-disabled";
import { MemberTicketsListPanel } from "@/me/tickets/member-tickets-list-panel";
import { resolveMemberTicketsPortalReadOnly } from "@/me/tickets/member-tickets-portal-mode.server";
import { resolveMemberPortalTicketsListPath } from "@/me/resolve-member-portal-routes.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

type TicketStatusFilter = "" | "open" | "pending_member" | "resolved" | "closed";

function parseStatusFilter(raw: string | string[] | undefined): TicketStatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === "open" ||
    value === "pending_member" ||
    value === "resolved" ||
    value === "closed"
  ) {
    return value;
  }
  return "";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.tickets");
  return { title: t("title") };
}

export default async function MeTicketsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly status?: string | string[] }>;
}) {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const params = await searchParams;
  const statusFilter = parseStatusFilter(params.status);
  const listResult = await fetchMemberTicketsList(
    host,
    statusFilter.length > 0 ? { status: statusFilter } : undefined,
  );
  const readOnly = await resolveMemberTicketsPortalReadOnly(bootstrap.tenantId);
  const ticketsPath = resolveMemberPortalTicketsListPath(bootstrap.pluginId);
  const t = await getTranslations("portalMember.tickets");

  if (listResult.status === "missing_cookie" || listResult.status === "unauthenticated") {
    redirectDeadMemberSession("/me/tickets");
  }

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="tickets">
      {listResult.status === "workspace_disabled" || listResult.status === "module_disabled" ? (
        <MemberTicketsDisabled
          reason={
            listResult.status === "module_disabled" ? "module_disabled" : "workspace_disabled"
          }
        />
      ) : listResult.status === "unavailable" || listResult.status === "api_error" ? (
        <main data-portal-member-tickets data-portal-member-tickets-state="error">
          <header data-portal-member-page-header>
            <h1>{t("title")}</h1>
            <p role="alert">{t("loadError")}</p>
          </header>
        </main>
      ) : listResult.status !== "ok" ? (
        <MemberTicketsDisabled reason="entitlement_denied" />
      ) : (
        <main data-portal-member-tickets data-portal-member-tickets-state="ready">
          <header data-portal-member-page-header>
            <h1>{t("title")}</h1>
            <p data-portal-member-tickets-lede>{t("lede")}</p>
            {readOnly ? null : (
              <a href={`${ticketsPath}/new`} data-portal-member-tickets-new-cta>
                {t("newCta")}
              </a>
            )}
          </header>
          <MemberTicketsListPanel
            initialList={listResult.payload.list}
            initialStatus={statusFilter}
          />
        </main>
      )}
    </MemberModuleEntitlementGate>
  );
}
