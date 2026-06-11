import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { isFinanceRouteAllowed } from "@/finance/finance-nav-access";
import { buildFinancePageMetadata } from "@/i18n/finance-page-metadata";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { FinanceCommandCenter } from "./finance-command-center";

export async function generateMetadata(): Promise<Metadata> {
  return buildFinancePageMetadata();
}

export const dynamic = "force-dynamic";

type FinancePageProps = {
  readonly searchParams: Promise<{ tab?: string }>;
};

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = resolveBootstrapAppSessionForHost(host);
  if (!isFinanceRouteAllowed(resolved.session.pluginId)) {
    notFound();
  }

  const params = await searchParams;
  return <FinanceCommandCenter session={session} initialTab={params.tab} />;
}
