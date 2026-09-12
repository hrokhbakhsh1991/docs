import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import {
  buildOperatorTicketsApiQuery,
  parseOperatorTicketsCommandCenterQuery,
} from "@/features/tickets/operator-tickets-command-center-logic";
import { fetchOperatorTicketsServerPrefetch } from "@/features/tickets/fetch-operator-tickets.server";
import { canAccessTicketsInbox } from "@/features/tickets/operator-tickets-types";
import { ensureTicketsRouteAllowed } from "@/features/tickets/tickets-nav-enablement";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { OperatorTicketsPageClient } from "./tickets-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tickets");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

type PageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toUrlSearchParams(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        next.append(key, entry);
      }
    } else {
      next.set(key, value);
    }
  }
  return next;
}

export default async function OperatorTicketsPage({ searchParams }: PageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null || !canAccessTicketsInbox(session.role)) {
    notFound();
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHost(host);
  const tenantTheme = await fetchTenantThemeForContext(resolved.context, host);
  if (!(await ensureTicketsRouteAllowed(resolved.session.pluginId, tenantTheme))) {
    notFound();
  }

  const params = await searchParams;
  const parsedQuery = parseOperatorTicketsCommandCenterQuery(toUrlSearchParams(params));
  const locale = (await getLocale()) === "fa" ? "fa" : "en";
  const initialPrefetch = await fetchOperatorTicketsServerPrefetch(
    buildOperatorTicketsApiQuery(parsedQuery),
    locale,
  );

  return <OperatorTicketsPageClient session={session} initialPrefetch={initialPrefetch} />;
}
