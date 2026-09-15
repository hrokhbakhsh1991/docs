"use client";

import { useLocale, useTranslations } from "next-intl";

import type { AppLocale } from "@/i18n/routing";
import {
  resolveTourKindDuration,
} from "@/features/tours/tour-list-category-logic";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
  formatTourUpdated,
} from "@/features/tours/tour-list-formatters";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { resolveTourPriceDisplayPolicy } from "@/features/tours/resolve-tour-price-display-policy";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { resolveWizardTourDurationLabel } from "@/wizard/wizard-label-surface-registry";

export type TourListRowModel = {
  readonly priceLabel: string | null;
  readonly departureLabel: string | null;
  readonly seatsLabel: string;
  readonly updatedLabel: string;
  readonly durationLabel: string | null;
};

export function useTourListRowModel(
  pluginId: string,
  tour: TourListProjection,
  showExtendedMeta: boolean
): TourListRowModel {
  const locale = useLocale() as AppLocale;
  const tFormat = useTranslations("tours.format");
  const tWorkspace = useWorkspaceWizardTranslator(pluginId);

  const priceLabel = formatTourPrice(
    tour.priceAmount,
    tour.priceCurrency,
    locale,
    resolveTourPriceDisplayPolicy(pluginId)
  );
  const departureLabel = formatTourDeparture(tour.departureAt, locale);
  const seatsLabel = formatTourSeats(tour, {
    withCapacity: (accepted, capacity) =>
      tFormat("seatsWithCapacity", { accepted, capacity }),
    open: (accepted) => tFormat("seatsOpen", { accepted }),
  });
  const updatedLabel = formatTourUpdated(tour.updatedAt, locale);
  const durationSlug = showExtendedMeta ? resolveTourKindDuration(pluginId, tour.category) : null;
  const durationLabel =
    durationSlug !== null
      ? resolveWizardTourDurationLabel(pluginId, tWorkspace, durationSlug)
      : null;

  return {
    priceLabel,
    departureLabel,
    seatsLabel,
    updatedLabel,
    durationLabel,
  };
}
