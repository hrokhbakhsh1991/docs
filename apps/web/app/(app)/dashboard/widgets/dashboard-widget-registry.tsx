"use client";

import type { ReactNode } from "react";

import {
  resolveTenantDashboardWidgets,
  type TenantDashboardWidgetId,
} from "@repo/core";

import { useTenantConfig } from "@/lib/tenant/tenant-config-provider";
import { useFinanceModuleAccess } from "@/lib/finance/use-finance-module-access";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";

import { FinanceWidget } from "./finance-widget";
import { ReconciliationWidget } from "./reconciliation-widget";
import { RegistrationsWidget } from "./registrations-widget";
import { StatsWidget } from "./stats-widget";
import { TourListWidget } from "./tour-list-widget";
import { UsersDirectoryWidget } from "./users-directory-widget";

import styles from "../dashboard.module.css";

function renderDashboardWidget(id: TenantDashboardWidgetId): ReactNode {
  switch (id) {
    case "tourList":
      return <TourListWidget />;
    case "stats":
      return <StatsWidget />;
    case "registrations":
      return <RegistrationsWidget />;
    case "reconciliation":
      return <ReconciliationWidget />;
    case "finance":
      return <FinanceWidget />;
    case "usersDirectory":
      return <UsersDirectoryWidget />;
    default:
      return null;
  }
}

export function DashboardWidgetsGrid() {
  const { config } = useTenantConfig();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const liveApi = toursUseLiveApi();
  const { hasFinanceModule } = useFinanceModuleAccess();
  const enabled = liveApi && isHydrated && isAuthenticated && leader;

  const widgetIds = resolveTenantDashboardWidgets(config.layout);

  if (!enabled) {
    return null;
  }

  const gridWidgets = widgetIds.filter((id) => id !== "usersDirectory");
  const showUsersDirectory = widgetIds.includes("usersDirectory");

  return (
    <>
      <ul className={styles.grid}>
        {gridWidgets.map((id) => {
          if (id === "finance" && !hasFinanceModule) {
            return null;
          }
          return (
            <li key={id} className={styles.gridItem}>
              {renderDashboardWidget(id)}
            </li>
          );
        })}
      </ul>
      {showUsersDirectory ? renderDashboardWidget("usersDirectory") : null}
    </>
  );
}
