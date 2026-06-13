import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchFinanceOverviewServer } from "@/finance/fetch-finance-overview.server";
import { fetchFinancePaymentsServer } from "@/finance/fetch-finance-payments.server";
import { fetchFinanceLedgerServer } from "@/finance/fetch-finance-ledger.server";
import { fetchFinancePrepaymentsServer } from "@/finance/fetch-finance-prepayments.server";
import { fetchFinanceReceiptsServer } from "@/finance/fetch-finance-receipts.server";
import { isFinanceRouteAllowed, parseFinanceTab } from "@/finance/finance-nav-access";
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
  const activeTab = parseFinanceTab(params.tab);
  const initialOverview = activeTab === "overview" ? await fetchFinanceOverviewServer() : null;
  const initialPayments = activeTab === "payments" ? await fetchFinancePaymentsServer() : null;
  const initialReceipts = activeTab === "receipts" ? await fetchFinanceReceiptsServer() : null;
  const initialLedger = activeTab === "ledger" ? await fetchFinanceLedgerServer() : null;
  const initialPrepayments =
    activeTab === "prepayments" ? await fetchFinancePrepaymentsServer() : null;

  return (
    <FinanceCommandCenter
      session={session}
      initialTab={params.tab}
      initialOverview={initialOverview}
      initialPayments={initialPayments}
      initialReceipts={initialReceipts}
      initialLedger={initialLedger}
      initialPrepayments={initialPrepayments}
    />
  );
}
