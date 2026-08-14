"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { cn } from "@/lib/utils";
import { FinanceCommercialMeaningEmbed } from "@/finance/finance-commercial-meaning-embed";
import {
  financeCommandCenterViewQueryValue,
  parseFinanceCommandCenterView,
  type FinanceCommandCenterViewMode,
} from "@/finance/finance-command-center-view";
import { buildFinanceCommercialMeaningHref } from "@/finance/finance-commercial-meaning-contract";
import { emitFinanceCommercialMeaningTelemetry } from "@/finance/finance-commercial-meaning-telemetry";
import { FinanceInstallmentsPanel } from "@/finance/finance-installments-panel";
import { FinanceLedgerPanel } from "@/finance/finance-ledger-panel";
import {
  listVisibleFinanceTabs,
  parseFinanceTab,
  resolveFinanceOpsCapabilityForHub,
  type FinanceCommandCenterTab,
  type FinanceOpsCapability,
} from "@/finance/finance-nav-access";
import { FinanceOverviewPanel } from "@/finance/finance-overview-panel";
import { FinancePaymentsPanel } from "@/finance/finance-payments-panel";
import { FinancePrepaymentsPanel } from "@/finance/finance-prepayments-panel";
import { FinanceReceiptsPanel } from "@/finance/finance-receipts-panel";
import { FinanceRefundsPanel } from "@/finance/finance-refunds-panel";
import { FinanceOutstandingPanel } from "@/finance/finance-outstanding-panel";
import { FinanceRegistrationFilterChip } from "@/finance/finance-registration-filter-chip";
import { FinanceTourFilter } from "@/finance/finance-tour-filter";
import { workspaceBasePath } from "@/features/tours/tour-workspace-logic";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type FinanceCommandCenterProps = {
  readonly session: OperatorSessionContext;
  /** Optional tenant theme for financeOps panel overrides (workspace ops binding + theme merge). */
  readonly theme?: unknown;
  /** Server-resolved PR18-B Command UI gate (fail-closed single tenant). */
  readonly commandUiEnabled?: boolean;
};

export function FinanceCommandCenter({
  session,
  theme = null,
  commandUiEnabled = false,
}: FinanceCommandCenterProps) {
  const t = useTranslations("finance.commandCenter");
  const tWorkspace = useTranslations("tours.workspace");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [capability, setCapability] = useState<FinanceOpsCapability | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setCapability(undefined);
    void resolveFinanceOpsCapabilityForHub(theme, session.pluginId).then((next) => {
      if (!cancelled) {
        setCapability(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [theme, session.pluginId]);

  const visibleTabs = useMemo(
    () => (capability === null || capability === undefined ? [] : listVisibleFinanceTabs(capability)),
    [capability]
  );
  const activeTab = useMemo(
    () => parseFinanceTab(searchParams.get("tab"), visibleTabs),
    [searchParams, visibleTabs]
  );
  const viewMode = useMemo(
    () => parseFinanceCommandCenterView(searchParams.get("view")),
    [searchParams]
  );
  const registrationId = searchParams.get("registrationId")?.trim() || null;
  const counterpartyId = searchParams.get("counterpartyId")?.trim() || undefined;
  const showPrepayments = capability?.panels.prepayments === true;
  const showInstallments = capability?.panels.installments === true;
  const firstCustomerOpsChrome = !showPrepayments && !showInstallments;

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

  const selectView = useCallback(
    (mode: FinanceCommandCenterViewMode) => {
      if (viewMode === "meaning" && mode === "operational") {
        emitFinanceCommercialMeaningTelemetry({
          name: "operator_returned_to_operational_view",
          registrationId,
        });
      }
      const next = new URLSearchParams(searchParams.toString());
      const viewValue = financeCommandCenterViewQueryValue(mode);
      if (viewValue === null) {
        next.delete("view");
      } else {
        next.set("view", viewValue);
      }
      const qs = next.toString();
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, registrationId, router, searchParams, viewMode]
  );

  if (capability === undefined || capability === null) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="finance-command-center">
      <PageHeader
        title={t("title")}
        description={firstCustomerOpsChrome ? t("subtitleFirstCustomer") : t("subtitle")}
      />

      {/* Meaning mode only when a registration is in context — avoids expert vocabulary on empty hub. */}
      {registrationId ? (
        <nav
          data-testid="finance-view-mode"
          className="flex gap-1 rounded-lg border bg-muted/40 p-1"
          aria-label={t("viewModeAria")}
        >
          <button
            type="button"
            data-view="operational"
            aria-current={viewMode === "operational" ? "page" : undefined}
            onClick={() => selectView("operational")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              viewMode === "operational"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("viewOperational")}
          </button>
          <button
            type="button"
            data-view="meaning"
            aria-current={viewMode === "meaning" ? "page" : undefined}
            onClick={() => selectView("meaning")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              viewMode === "meaning"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("viewCommercialMeaning")}
          </button>
        </nav>
      ) : null}

      {viewMode === "meaning" && registrationId ? (
        <div className="space-y-4" data-testid="finance-commercial-meaning">
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {t("commercialMeaningGuidanceSimple")}
          </p>
          <FinanceRegistrationFilterChip
            registrationId={registrationId}
            filteredLabel={t("filteredByRegistration")}
            clearLabel={t("clearRegistrationFilter")}
            technicalIdLabel={t("registrationTechnicalId")}
            onClear={() => {
              const next = new URLSearchParams(searchParams.toString());
              next.delete("registrationId");
              next.delete("view");
              const qs = next.toString();
              router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, {
                scroll: false,
              });
            }}
          />
          <FinanceCommercialMeaningEmbed
            registrationId={registrationId}
            counterpartyId={counterpartyId}
            commandUiEnabled={commandUiEnabled}
          />
        </div>
      ) : (
        <>
          <p
            className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
            data-testid="finance-tab-guidance"
          >
            {firstCustomerOpsChrome ? t("tabGuidanceFirstCustomerUx1") : t("tabGuidance")}
          </p>

          {registrationId ? (
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
              data-testid="finance-open-commercial-meaning"
            >
              <span className="text-muted-foreground">{t("openCommercialMeaningHint")}</span>
              <a
                className="text-primary underline-offset-2 hover:underline"
                href={buildFinanceCommercialMeaningHref(registrationId)}
                data-testid="finance-open-commercial-meaning-link"
              >
                {t("viewCommercialMeaning")}
              </a>
            </div>
          ) : null}

          {firstCustomerOpsChrome ? (
            <details
              className="rounded-md border px-3 py-2 text-sm"
              data-testid="finance-operator-help"
            >
              <summary
                className="cursor-pointer font-medium text-foreground"
                data-testid="finance-operator-help-summary"
              >
                {t("operatorHelpSummary")}
              </summary>
              <div
                className="mt-3 space-y-3 border-t pt-3"
                data-testid="finance-operator-state-guide"
              >
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{t("operatorStateGuideTitle")}</p>
                  <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                    <li>{t("operatorStateUnpaid")}</li>
                    <li>{t("operatorStatePartial")}</li>
                    <li>{t("operatorStatePendingPayment")}</li>
                    <li>{t("operatorStatePendingReceipt")}</li>
                    <li>{t("operatorStatePaid")}</li>
                    <li>{t("operatorStateOutstanding")}</li>
                  </ul>
                </div>
                <div className="space-y-1 border-t pt-2">
                  <p className="text-xs font-medium text-foreground">{t("operatorStateVocabTitle")}</p>
                  <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
                    <li>{t("operatorStateVocabRecorded")}</li>
                    <li>{t("operatorStateVocabBookingPaid")}</li>
                    <li>{t("operatorStateVocabPaymentPending")}</li>
                    <li>{t("operatorStateVocabReceiptPending")}</li>
                    <li>{t("operatorStateVocabOutstanding")}</li>
                  </ul>
                </div>
              </div>
            </details>
          ) : (
            <details
              className="rounded-md border px-3 py-2 text-sm"
              data-testid="finance-decision-guide"
            >
              <summary className="cursor-pointer font-medium text-foreground">
                {t("operatorHelpSummary")}
              </summary>
              <div className="mt-3 space-y-2 border-t pt-3">
                <p className="font-medium text-foreground">{t("decisionGuideTitle")}</p>
                <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                  <li>{t("decisionGuideManual")}</li>
                  <li>{t("decisionGuideReceipt")}</li>
                  {showPrepayments ? <li>{t("decisionGuidePrepayment")}</li> : null}
                  {showInstallments ? <li>{t("decisionGuideInstallment")}</li> : null}
                </ul>
              </div>
            </details>
          )}

          {registrationId ? (
            <FinanceRegistrationFilterChip
              registrationId={registrationId}
              filteredLabel={t("filteredByRegistration")}
              clearLabel={t("clearRegistrationFilter")}
              technicalIdLabel={t("registrationTechnicalId")}
              onClear={() => {
                const next = new URLSearchParams(searchParams.toString());
                next.delete("registrationId");
                const qs = next.toString();
                router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, {
                  scroll: false,
                });
              }}
            />
          ) : null}

          {searchParams.get("tourId") ? (
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
              data-testid="finance-tour-filter-banner"
            >
              <span className="text-muted-foreground">{t("filteredByTour")}</span>
              <span className="text-sm font-medium">
                {t("tourFilterActiveHint")}
              </span>
              <Button asChild variant="outline" size="sm" data-testid="finance-open-tour-workspace">
                <Link href={workspaceBasePath(searchParams.get("tourId") ?? "")}>
                  {tWorkspace("openWorkspace")}
                </Link>
              </Button>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  const next = new URLSearchParams(searchParams.toString());
                  next.delete("tourId");
                  const qs = next.toString();
                  router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, {
                    scroll: false,
                  });
                }}
              >
                {t("clearTourFilter")}
              </button>
            </div>
          ) : null}

          <FinanceTourFilter className="rounded-md border bg-muted/20 px-3 py-3" />

          <nav
            data-operator-finance-tabs
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

          {activeTab === "overview" ? (
            <FinanceOverviewPanel includeInstallments={showInstallments} />
          ) : null}
          {activeTab === "payments" ? <FinancePaymentsPanel session={session} /> : null}
          {activeTab === "receipts" ? <FinanceReceiptsPanel session={session} /> : null}
          {activeTab === "outstanding" ? <FinanceOutstandingPanel /> : null}
          {activeTab === "prepayments" ? <FinancePrepaymentsPanel session={session} /> : null}
          {activeTab === "installments" ? <FinanceInstallmentsPanel session={session} /> : null}
          {activeTab === "ledger" ? <FinanceLedgerPanel session={session} /> : null}
          {activeTab === "refunds" ? <FinanceRefundsPanel /> : null}
        </>
      )}
    </div>
  );
}
