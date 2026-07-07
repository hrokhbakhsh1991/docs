"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { resolveDenaliTourKindLabel } from "@/i18n/denali-wizard-labels";
import { isTourKindSlug } from "@/features/tours/tour-list-category-logic";

type TourCategoryBadgeProps = {
  readonly pluginId: string;
  readonly category: string | null;
};

export function TourCategoryBadge({ pluginId, category }: TourCategoryBadgeProps) {
  const t = useTranslations("denali");

  if (!isTourKindSlug(pluginId, category)) {
    return null;
  }

  return (
    <Badge variant="outline" data-denali-category-badge>
      {resolveDenaliTourKindLabel(t, category)}
    </Badge>
  );
}
