"use client";

import { useLayoutEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import type { TourFormProfile } from "@repo/types";

import { applyDenaliInvariantState } from "../validation/denaliInvariantEngine";
import { sanitizeDenaliWizardCatalogRefs } from "../sanitizeDenaliWizardCatalogRefs";
import type { DenaliRuleSet } from "../rules/denaliRuleModel";

/**
 * One-shot catalog ref cleanup after destinations/themes load (edit + clone hydrate).
 * Returns whether canonical state should re-sync after `reset`.
 */
export function useDenaliEditCatalogSanitize(
  formMethods: Pick<UseFormReturn<DenaliCreateTourWizardForm>, "getValues" | "reset">,
  onSanitized: () => void,
  mergedRuleSet: DenaliRuleSet,
  workspaceFormProfile: TourFormProfile,
): void {
  const { getValues, reset } = formMethods;
  const themesQuery = useSettingsTourThemes();
  const destinationsQuery = useTourDestinations();
  const catalogSanitizedRef = useRef(false);

  useLayoutEffect(() => {
    if (catalogSanitizedRef.current) {
      return;
    }
    if (destinationsQuery.isLoading || themesQuery.isLoading) {
      return;
    }
    if (!destinationsQuery.groupedRegions || !themesQuery.data) {
      return;
    }
    const destinationIds = new Set(
      destinationsQuery.groupedRegions.flatMap((group) => group.items.map((item) => item.id)),
    );
    const themeIds = new Set(
      (themesQuery.data ?? []).filter((theme) => theme.isActive).map((theme) => theme.id),
    );
    const current = getValues();
    const { form: sanitized, clearedDestination, clearedThemeIds } = sanitizeDenaliWizardCatalogRefs(
      current,
      { destinationIds, themeIds },
    );
    catalogSanitizedRef.current = true;
    if (!clearedDestination && clearedThemeIds === 0) {
      return;
    }
    const next = applyDenaliInvariantState(
      sanitized,
      { workspaceFormProfile },
      mergedRuleSet,
    );
    reset(next, { keepDefaultValues: true });
    onSanitized();
  }, [
    destinationsQuery.groupedRegions,
    destinationsQuery.isLoading,
    getValues,
    mergedRuleSet,
    onSanitized,
    reset,
    themesQuery.data,
    themesQuery.isLoading,
    workspaceFormProfile,
  ]);
}
