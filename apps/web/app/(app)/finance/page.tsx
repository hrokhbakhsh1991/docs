import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { ensureFinanceRouteAllowed } from "@/finance/finance-nav-enablement";
import { isFinanceCaseCommandUiEnabledForTenant } from "@/finance/finance-case-command-ui-rollout";
import { buildFinancePageMetadata } from "@/i18n/finance-page-metadata";
import { resolveRequestBootstrapAppSession } from "@/tenant/tenant-kernel";

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

  const resolved = await resolveRequestBootstrapAppSession();
  if (!(await ensureFinanceRouteAllowed(resolved.session.pluginId))) {
    notFound();
  }

  const commandUiEnabled = isFinanceCaseCommandUiEnabledForTenant(session.tenantId);

  return (
    <Suspense fallback={null}>
      <FinanceCommandCenter session={session} commandUiEnabled={commandUiEnabled} />
    </Suspense>
  );
}
