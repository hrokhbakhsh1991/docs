"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { resolveDenaliTourKindLabel } from "@/i18n/denali-wizard-labels";
import { isDenaliTourCategory } from "@/features/tours/tour-list-category-logic";

type TourCategoryBadgeProps = {
  readonly category: string | null;
};

export function TourCategoryBadge({ category }: TourCategoryBadgeProps) {
  const t = useTranslations("denali");

  if (!isDenaliTourCategory(category)) {
    return null;
  }

  return (
    <Badge variant="outline" data-denali-category-badge className="w-fit">
      {resolveDenaliTourKindLabel(t, category)}
    </Badge>
  );
}
