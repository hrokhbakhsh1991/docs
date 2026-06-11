"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { cn } from "@/lib/utils";
import { FinanceInstallmentsPanel } from "@/finance/finance-installments-panel";
import { FinanceLedgerPanel } from "@/finance/finance-ledger-panel";
import {
  FINANCE_COMMAND_CENTER_TABS,
  parseFinanceTab,
  type FinanceCommandCenterTab,
} from "@/finance/finance-nav-access";
import { FinanceOverviewPanel } from "@/finance/finance-overview-panel";
import { FinancePaymentsPanel } from "@/finance/finance-payments-panel";
import { FinancePrepaymentsPanel } from "@/finance/finance-prepayments-panel";
import { FinanceReceiptsPanel } from "@/finance/finance-receipts-panel";

type FinanceCommandCenterProps = {
  readonly session: OperatorSessionContext;
  readonly initialTab?: string;
};

export function FinanceCommandCenter({ session, initialTab }: FinanceCommandCenterProps) {
  const t = useTranslations("finance.commandCenter");
  const activeTab = useMemo(() => parseFinanceTab(initialTab), [initialTab]);

  return (
    <div className="space-y-6" data-testid="finance-command-center">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <nav
        data-denali-finance-tabs
        className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
        aria-label={t("tabsAria")}
      >
        {FINANCE_COMMAND_CENTER_TABS.map((tab) => (
          <a
            key={tab}
            href={`/finance?tab=${tab}`}
            data-tab={tab}
            aria-current={activeTab === tab ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`tabs.${tab}` as `tabs.${FinanceCommandCenterTab}`)}
          </a>
        ))}
      </nav>

      {activeTab === "overview" ? <FinanceOverviewPanel /> : null}
      {activeTab === "payments" ? <FinancePaymentsPanel session={session} /> : null}
      {activeTab === "receipts" ? <FinanceReceiptsPanel session={session} /> : null}
      {activeTab === "prepayments" ? <FinancePrepaymentsPanel session={session} /> : null}
      {activeTab === "installments" ? <FinanceInstallmentsPanel session={session} /> : null}
      {activeTab === "ledger" ? <FinanceLedgerPanel session={session} /> : null}
    </div>
  );
}
