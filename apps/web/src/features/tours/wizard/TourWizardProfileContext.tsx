"use client";

import type { TourFormProfile } from "@repo/types";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";

import { getProfileRules } from "@/features/tours/wizard/profileRules/getProfileRules";
import type { ProfileRules } from "@/features/tours/wizard/profileRules/types";

import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";

import type { TourWizardDraftMeta } from "./tourWizardProfileResolve";

/**
 * `resolvedProfile` is typed as `TourFormProfile` for back-compat with existing
 * consumers but is structurally identical to `TourDomainProfile` — the canonical
 * name introduced in Phase A of the unified-domain plan
 * (`packages/types/src/tour-domain-profile.ts`).
 */
export type TourWizardProfileContextValue = {
  /** Canonical tour classification (alias `TourDomainProfile`). */
  resolvedProfile: TourFormProfile;
  /** Snapshot from duplicate / draft; undefined if none. */
  draftMeta: TourWizardDraftMeta | undefined;
  /**
   * Memoized rules table for `resolvedProfile`. Filled automatically by the provider when
   * callers pass only `{ resolvedProfile, draftMeta }` so existing call sites do not need to
   * compute it themselves (M3 addition — see "Phase Design — Wizard-only Architecture" in
   * `prompt.md`).
   */
  rules: ProfileRules;
  /** Tenant `enabled_modules` overlay on the shared CREATE contract (Phase 8.2.1). */
  tenantFormContract: TenantTourFormContract;
};

/** Shape callers may pass; `rules` is optional and filled by the provider. */
export type TourWizardProfileProviderValue =
  | TourWizardProfileContextValue
  | (Omit<TourWizardProfileContextValue, "rules"> & { rules?: undefined });

const TourWizardProfileContext = createContext<TourWizardProfileContextValue | null>(null);

export function TourWizardProfileProvider({
  value,
  children,
}: {
  value: TourWizardProfileProviderValue;
  children: ReactNode;
}) {
  const memo = useMemo<TourWizardProfileContextValue>(() => {
    const rules: ProfileRules =
      value.rules ?? getProfileRules(value.resolvedProfile);
    return {
      resolvedProfile: value.resolvedProfile,
      draftMeta: value.draftMeta,
      rules,
      tenantFormContract: value.tenantFormContract,
    };
  }, [value.resolvedProfile, value.draftMeta, value.rules, value.tenantFormContract]);
  return (
    <TourWizardProfileContext.Provider value={memo}>{children}</TourWizardProfileContext.Provider>
  );
}

export function useTourWizardProfile(): TourWizardProfileContextValue {
  const v = useContext(TourWizardProfileContext);
  if (!v) {
    throw new Error("useTourWizardProfile must be used within TourWizardProfileProvider");
  }
  return v;
}
