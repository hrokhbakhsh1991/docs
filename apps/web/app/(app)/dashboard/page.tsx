import type { Metadata } from "next";
import { fetchDashboardServerPrefetch } from "@/admin/dashboard/fetch-dashboard-data.server";
import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildDashboardPageMetadata } from "@/i18n/app-page-metadata";
import { resolveRequestBootstrapAppSession } from "@/tenant/tenant-kernel";
import { resolveFinanceNavCapability } from "@app-tour/workspace-sdk";

import { DashboardPageClient } from "./dashboard-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildDashboardPageMetadata();
}

export const dynamic = "force-dynamic";

export default async function OperatorDashboardPage() {
  const session = await readOperatorSessionFromCookies();
  const resolved = await resolveRequestBootstrapAppSession();
  const initialPrefetch = await fetchDashboardServerPrefetch();
  const initialFinanceNavSupported =
    resolveFinanceNavCapability(resolved.plugin)?.supported === true;

  return (
    <DashboardPageClient
      pluginId={resolved.session.pluginId}
      role={session?.role ?? "none"}
      initialFinanceNavSupported={initialFinanceNavSupported}
      initialPrefetch={initialPrefetch}
    />
  );
}
