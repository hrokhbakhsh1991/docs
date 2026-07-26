import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { ensureFinanceRouteAllowed } from "@/finance/finance-nav-enablement";
import { buildFinancePageMetadata } from "@/i18n/finance-page-metadata";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { FinanceCommandCenter } from "./finance-command-center";

export async function generateMetadata(): Promise<Metadata> {
  return buildFinancePageMetadata();
}

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHost(host);
  if (!(await ensureFinanceRouteAllowed(resolved.session.pluginId))) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <FinanceCommandCenter session={session} />
    </Suspense>
  );
}
