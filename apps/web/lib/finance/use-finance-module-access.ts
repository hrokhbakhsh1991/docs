"use client";

import { useMemo } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { useAbility } from "@/lib/casl/ability-provider";

import {
  canAccessFinanceManualPayments,
  canReviewFinanceReceipts,
  canUploadFinanceReceipts,
  userHasFinanceModuleCapability,
} from "./finance-module-access";

export function useFinanceModuleAccess() {
  const { user } = useAuth();
  const ability = useAbility();

  return useMemo(
    () => ({
      hasFinanceModule: userHasFinanceModuleCapability(user),
      canListManualPayments: canAccessFinanceManualPayments(ability),
      canUploadReceipt: canUploadFinanceReceipts(ability),
      canReviewReceipts: canReviewFinanceReceipts(ability, user),
    }),
    [ability, user],
  );
}
