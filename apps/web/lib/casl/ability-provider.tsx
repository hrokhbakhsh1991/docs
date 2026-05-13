"use client";

import { useAbility as useCaslAbility } from "@casl/react";
import { useMemo, type ReactNode } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { defineAbilityFor, type AppAbility, type UserAbilityMembershipStatus } from "@repo/shared-rbac";

import { AbilityContext, GUEST_APP_ABILITY } from "./ability-context";

/**
 * Binds CASL {@link AppAbility} to the authenticated workspace session.
 * Rebuilds when `userId`, `tenantId`, or `role` changes (e.g. workspace switch / token refresh).
 */
export function AbilityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const ability = useMemo<AppAbility>(() => {
    if (!isAuthenticated || !user?.userId?.trim() || !user?.role?.trim()) {
      return GUEST_APP_ABILITY;
    }
    const status = (user.membershipStatus ?? "ACTIVE") as UserAbilityMembershipStatus;
    return defineAbilityFor({
      id: user.userId.trim(),
      role: user.role.trim(),
      status,
      labels: user.abilityLabels ?? null
    });
  }, [
    isAuthenticated,
    user?.userId,
    user?.tenantId,
    user?.role,
    user?.membershipStatus,
    user?.abilityLabels
  ]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}

/** CASL ability for the active workspace actor (UI gating only). */
export function useAbility(): AppAbility {
  return useCaslAbility(AbilityContext);
}
