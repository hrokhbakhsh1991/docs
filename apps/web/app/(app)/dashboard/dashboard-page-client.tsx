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
import { shouldShowFinanceDashboardWidget } from "@/finance/finance-dashboard-widget-logic";
import { FinanceDashboardWidget } from "@/finance/finance-dashboard-widget";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

type DashboardPageClientProps = {
  readonly pluginId: string;
  readonly role: string;
};

export function DashboardPageClient({ pluginId, role }: DashboardPageClientProps) {
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
      />

      <div className="flex flex-wrap gap-2" data-denali-quick-actions>
        <Button asChild>
          <Link href={OPERATOR_WIZARD_PATH}>{t("quickActions.newTour")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/tours">{t("quickActions.allTours")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/bookings">{t("quickActions.bookings")}</Link>
        </Button>
      </div>

      <div
        data-testid={DASHBOARD_GRID_TEST_ID}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <div data-denali-animate="fade-up">
          <DashboardOverviewWidget />
        </div>
        <div data-denali-animate="fade-up" data-denali-animate-delay="1">
          <DashboardToursWidget />
        </div>
        <div data-denali-animate="fade-up" data-denali-animate-delay="2">
          <DashboardBookingsWidget />
        </div>
        <div data-denali-animate="fade-up" data-denali-animate-delay="3">
          <DashboardRegistrationsWidget />
        </div>
        {showFinanceWidget ? (
          <div data-denali-animate="fade-up" data-denali-animate-delay="3">
            <FinanceDashboardWidget />
          </div>
        ) : null}
      </div>
    </section>
  );
}
