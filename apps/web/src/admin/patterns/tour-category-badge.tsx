"use client";

import { Badge } from "@/components/ui/badge";
import { isTourKindSlug } from "@/features/tours/tour-list-category-logic";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { resolveWizardTourKindLabel } from "@/wizard/wizard-label-surface-registry";

type TourCategoryBadgeProps = {
  readonly pluginId: string;
  readonly category: string | null;
};

export function TourCategoryBadge({ pluginId, category }: TourCategoryBadgeProps) {
  const tWorkspace = useWorkspaceWizardTranslator(pluginId);

  if (category == null || !isTourKindSlug(pluginId, category)) {
    return null;
  }

  return (
    <Badge variant="outline" data-operator-category-badge>
      {resolveWizardTourKindLabel(pluginId, tWorkspace, category)}
    </Badge>
  );
}
