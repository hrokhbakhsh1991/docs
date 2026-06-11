import type { Metadata } from "next";
import { headers } from "next/headers";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildDashboardPageMetadata } from "@/i18n/app-page-metadata";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { DashboardPageClient } from "./dashboard-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildDashboardPageMetadata();
}

export const dynamic = "force-dynamic";

export default async function OperatorDashboardPage() {
  const session = await readOperatorSessionFromCookies();
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = resolveBootstrapAppSessionForHost(host);

  return (
    <DashboardPageClient
      pluginId={resolved.session.pluginId}
      role={session?.role ?? "none"}
    />
  );
}
