"use client";

import { useFinanceModuleAccess } from "@/lib/finance/use-finance-module-access";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";

import { FinanceWorkspaceSummaryCard } from "../finance-workspace-summary-card";

export function FinanceWidget() {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const liveApi = toursUseLiveApi();
  const { hasFinanceModule, canReviewReceipts } = useFinanceModuleAccess();
  const enabled = liveApi && isHydrated && isAuthenticated && leader && hasFinanceModule;

  if (!enabled) {
    return null;
  }

  return <FinanceWorkspaceSummaryCard canReviewReceipts={canReviewReceipts} />;
}
