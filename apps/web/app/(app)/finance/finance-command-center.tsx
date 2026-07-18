"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { cn } from "@/lib/utils";
import { FinanceInstallmentsPanel } from "@/finance/finance-installments-panel";
import { FinanceLedgerPanel } from "@/finance/finance-ledger-panel";
import {
  listVisibleFinanceTabs,
  parseFinanceTab,
  resolveFinanceOpsCapabilityForHub,
  type FinanceCommandCenterTab,
} from "@/finance/finance-nav-access";
import { FinanceOverviewPanel } from "@/finance/finance-overview-panel";
import { FinancePaymentsPanel } from "@/finance/finance-payments-panel";
import { FinancePrepaymentsPanel } from "@/finance/finance-prepayments-panel";
import { FinanceReceiptsPanel } from "@/finance/finance-receipts-panel";

type FinanceCommandCenterProps = {
  readonly session: OperatorSessionContext;
  /** Optional tenant theme for financeOps panel overrides (workspace ops binding + theme merge). */
  readonly theme?: unknown;
};

export function FinanceCommandCenter({ session, theme = null }: FinanceCommandCenterProps) {
  const t = useTranslations("finance.commandCenter");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const capability = useMemo(
    () => resolveFinanceOpsCapabilityForHub(theme, session.pluginId),
    [theme, session.pluginId]
  );

  const visibleTabs = useMemo(
    () => (capability === null ? [] : listVisibleFinanceTabs(capability)),
    [capability]
  );
  const activeTab = useMemo(
    () => parseFinanceTab(searchParams.get("tab"), visibleTabs),
    [searchParams, visibleTabs]
  );

  const selectTab = useCallback(
    (tab: FinanceCommandCenterTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      const qs = next.toString();
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  if (capability === null) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="finance-command-center">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <p
        className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
        data-testid="finance-tab-guidance"
      >
        {t("tabGuidance")}
      </p>

      <div
        className="rounded-md border px-3 py-3 text-sm space-y-2"
        data-testid="finance-decision-guide"
      >
        <p className="font-medium text-foreground">{t("decisionGuideTitle")}</p>
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{t("decisionGuideManual")}</li>
          <li>{t("decisionGuidePrepayment")}</li>
          <li>{t("decisionGuideInstallment")}</li>
        </ul>
      </div>

      {searchParams.get("registrationId") ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
          data-testid="finance-registration-filter"
        >
          <span className="text-muted-foreground">{t("filteredByRegistration")}</span>
          <code className="font-mono text-xs">{searchParams.get("registrationId")}</code>
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              next.delete("registrationId");
              const qs = next.toString();
              router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
            }}
          >
            {t("clearRegistrationFilter")}
          </button>
        </div>
      ) : null}

      <nav
        data-denali-finance-tabs
        className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
        aria-label={t("tabsAria")}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            data-tab={tab}
            aria-current={activeTab === tab ? "page" : undefined}
            onClick={() => selectTab(tab)}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              tab === "ledger" ? "opacity-90" : undefined
            )}
          >
            {t(`tabs.${tab}` as `tabs.${FinanceCommandCenterTab}`)}
            {tab === "ledger" ? (
              <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                ({t("ledgerAuditHint")})
              </span>
            ) : null}
          </button>
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
