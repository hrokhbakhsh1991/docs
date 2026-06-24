"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { OperatorWelcomeGate } from "@/admin/onboarding/operator-welcome-gate";
import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import { PageHeader } from "@/admin/patterns/page-header";
import { Button } from "@/components/ui/button";
import { DASHBOARD_GRID_TEST_ID } from "@/admin/dashboard/dashboard-widget-registry";
import { DashboardBookingsWidget } from "@/admin/dashboard/dashboard-bookings-widget";
import { DashboardOverviewWidget } from "@/admin/dashboard/dashboard-overview-widget";
import { DashboardRegistrationsWidget } from "@/admin/dashboard/dashboard-registrations-widget";
import { DashboardToursWidget } from "@/admin/dashboard/dashboard-tours-widget";
import type { DashboardServerPrefetch } from "@/admin/dashboard/dashboard-widgets-logic";
import { shouldShowFinanceDashboardWidget } from "@/finance/finance-dashboard-widget-logic";
import { FinanceDashboardWidget } from "@/finance/finance-dashboard-widget";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";
import { cn } from "@/lib/utils";

type DashboardPageClientProps = {
  readonly pluginId: string;
  readonly role: string;
  readonly initialPrefetch?: DashboardServerPrefetch | null;
};

const DASHBOARD_WIDGET_SLOT_CLASS = "h-full min-h-0";

export function DashboardPageClient({
  pluginId,
  role,
  initialPrefetch = null,
}: DashboardPageClientProps) {
  const t = useTranslations("dashboard");
  const brandName = useTenantBrandTitle();
  const showFinanceWidget = shouldShowFinanceDashboardWidget(pluginId, role);

  return (
    <section data-operator-dashboard className="space-y-6">
      <OperatorWelcomeGate pluginId={pluginId} role={role} />
      <PageHeader
        title={t("pageTitle")}
        description={
          role === "owner"
            ? t("pageSubtitleOwner", { brandName })
            : t("pageSubtitle", { brandName })
        }
        actions={
          <div className="flex flex-wrap gap-2" data-denali-quick-actions>
            <Button asChild size="sm" className="min-h-9">
              <Link href={OPERATOR_WIZARD_PATH}>{t("quickActions.newTour")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-9">
              <Link href="/tours">{t("quickActions.allTours")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-9">
              <Link href="/bookings">{t("quickActions.bookings")}</Link>
            </Button>
          </div>
        }
      />

      <div
        data-testid={DASHBOARD_GRID_TEST_ID}
        data-operator-dashboard-grid
        className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-12"
      >
        <div className={cn(DASHBOARD_WIDGET_SLOT_CLASS, "xl:col-span-4")} data-denali-animate="fade-up">
          <DashboardOverviewWidget
            initialToursTotal={initialPrefetch?.tours?.total ?? null}
            initialBookingsSummary={initialPrefetch?.bookingsSummary ?? null}
          />
        </div>
        <div
          className={cn(DASHBOARD_WIDGET_SLOT_CLASS, "xl:col-span-4")}
          data-denali-animate="fade-up"
          data-denali-animate-delay="1"
        >
          <DashboardToursWidget initialTours={initialPrefetch?.tours ?? null} />
        </div>
        <div
          className={cn(DASHBOARD_WIDGET_SLOT_CLASS, "xl:col-span-4")}
          data-denali-animate="fade-up"
          data-denali-animate-delay="2"
        >
          <DashboardBookingsWidget
            initialBookingsSummary={initialPrefetch?.bookingsSummary ?? null}
          />
        </div>
        <div
          className={cn(DASHBOARD_WIDGET_SLOT_CLASS, "md:col-span-1 xl:col-span-6")}
          data-denali-animate="fade-up"
          data-denali-animate-delay="3"
        >
          <DashboardRegistrationsWidget
            initialBookingsSummary={initialPrefetch?.bookingsSummary ?? null}
          />
        </div>
        {showFinanceWidget ? (
          <div
            className={cn(DASHBOARD_WIDGET_SLOT_CLASS, "md:col-span-2 xl:col-span-6")}
            data-denali-animate="fade-up"
            data-denali-animate-delay="4"
          >
            <FinanceDashboardWidget
              initialFinanceSummary={initialPrefetch?.financeSummary ?? null}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
