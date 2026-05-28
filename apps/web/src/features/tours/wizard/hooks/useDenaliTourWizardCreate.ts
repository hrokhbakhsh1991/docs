"use client";

import type { TourFormProfile } from "@repo/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DENALI_CREATE_DRAFT_KEY } from "@/features/tours/drafts/denali-adapter";
import { createTourFromWorkspaceWizardForm } from "@/features/tours/wizard/domain/createTourFromWizard";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { deleteDraftSnapshot } from "@/lib/draft-engine.client";
import { tourKeys } from "@/lib/query-keys";

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
        workspaceId: workspaceId ?? undefined,
        themeCatalog: input.themeCatalog,
        sourcePresetId: input.sourcePresetId,
        sourceTourId: input.sourceTourId,
      });
    },
    onSuccess: async () => {
      const ws = workspaceId?.trim();
      if (ws) {
        await deleteDraftSnapshot(ws, DENALI_CREATE_DRAFT_KEY).catch(() => undefined);
      }
      if (ws) {
        await queryClient.invalidateQueries({ queryKey: tourKeys.listByWorkspace(ws) });
      } else {
        await queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
      }
    },
  });
}
