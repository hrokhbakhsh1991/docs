import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { FinanceCaseEncounterPanel } from "@/finance/finance-case-encounter-panel";
import { ensureFinanceRouteAllowed } from "@/finance/finance-nav-enablement";
import { buildFinancePageMetadata } from "@/i18n/finance-page-metadata";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

type PageProps = {
  readonly params: Promise<{ readonly registrationId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return buildFinancePageMetadata();
}

export const dynamic = "force-dynamic";

/**
 * Operator read-only Case Encounter (PR12-A).
 * No mutation chrome — understandability only.
 */
export default async function FinanceCaseEncounterPage({ params }: PageProps) {
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

  const { registrationId } = await params;
  if (!registrationId || registrationId.trim().length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6" data-testid="finance-case-encounter-page">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Finance case</h1>
        <p className="text-sm text-muted-foreground">
          Read-only interpretation for registration {registrationId}. Refresh reloads a fresh
          execution — nothing is saved as Case state.
        </p>
      </header>
      <FinanceCaseEncounterPanel registrationId={registrationId.trim()} />
    </main>
  );
}
