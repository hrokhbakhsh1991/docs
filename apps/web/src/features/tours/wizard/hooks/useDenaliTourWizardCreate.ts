"use client";

import type { TourFormProfile } from "@repo/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { createTourFromWorkspaceWizardForm } from "@/features/tours/wizard/domain/createTourFromWizard";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { deleteTourWizardDraft } from "@/lib/tour-wizard-draft.client";
import { tourKeys } from "@/lib/query-keys";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useDenaliTourWizardCreate() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryScope();

  return useMutation({
    mutationFn: async (input: {
      values: DenaliCreateTourWizardForm;
      ruleSet: DenaliRuleSet;
      workspaceFormProfile: TourFormProfile;
      themeCatalog?: readonly { id: string; name: string }[];
      sourcePresetId?: string;
      sourceTourId?: string;
    }) => {
      return createTourFromWorkspaceWizardForm({
        values: input.values,
        ruleSet: input.ruleSet,
        workspaceFormProfile: input.workspaceFormProfile,
        themeCatalog: input.themeCatalog,
        sourcePresetId: input.sourcePresetId,
        sourceTourId: input.sourceTourId,
      });
    },
    onSuccess: async () => {
      const ws = workspaceId?.trim();
      if (ws && UUID_RE.test(ws)) {
        await deleteTourWizardDraft(ws).catch(() => {});
      }
      await queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
    },
  });
}
