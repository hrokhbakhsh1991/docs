import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { redirectDeadMemberSession } from "@/me/redirect-dead-member-session.server";
import {
  fetchMemberTicketCategories,
  fetchMemberTicketDetail,
} from "@/me/tickets/fetch-member-tickets.server";
import { MemberTicketDetailPanel } from "@/me/tickets/member-ticket-detail-panel";
import { MemberTicketsDisabled } from "@/me/tickets/member-tickets-disabled";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

type PageProps = {
  readonly params: Promise<{ readonly ticketId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticketId } = await params;
  const t = await getTranslations("portalMember.tickets");
  return { title: t("detailTitle", { id: ticketId.slice(0, 8) }) };
}

export default async function MeTicketDetailPage({ params }: PageProps) {
  const { ticketId } = await params;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const [detailResult, categoriesResult] = await Promise.all([
    fetchMemberTicketDetail(host, ticketId),
    fetchMemberTicketCategories(host),
  ]);
  const t = await getTranslations("portalMember.tickets");

  if (detailResult.status === "missing_cookie" || detailResult.status === "unauthenticated") {
    redirectDeadMemberSession(`/me/tickets/${ticketId}`);
  }

  if (detailResult.status === "api_error" && detailResult.code === "TICKET_NOT_FOUND") {
    notFound();
  }

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="tickets">
      {detailResult.status === "workspace_disabled" || detailResult.status === "module_disabled" ? (
        <MemberTicketsDisabled
          reason={
            detailResult.status === "module_disabled" ? "module_disabled" : "workspace_disabled"
          }
        />
      ) : detailResult.status !== "ok" ? (
        <main data-portal-member-ticket-detail data-portal-member-tickets-state="error">
          <header data-portal-member-page-header>
            <h1>{t("detailTitle", { id: ticketId.slice(0, 8) })}</h1>
            <p role="alert">{t("loadError")}</p>
          </header>
        </main>
      ) : (
        <main data-portal-member-ticket-detail-page>
          <MemberTicketDetailPanel
            initialDetail={detailResult.payload.detail}
            attachmentsEnabled={
              categoriesResult.status === "ok"
                ? categoriesResult.payload.categories.attachmentsEnabled
                : false
            }
            maxAttachmentSizeBytes={
              categoriesResult.status === "ok"
                ? categoriesResult.payload.categories.maxAttachmentSizeBytes
                : 0
            }
          />
        </main>
      )}
    </MemberModuleEntitlementGate>
  );
}
