"use client";

import type { TourFormProfile } from "@repo/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DENALI_CREATE_DRAFT_KEY } from "@/features/tours/drafts/denali-adapter";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import {
  buildDenaliSubmitPayloadProjection,
  mapDenaliCreateTourPayloadProjectionToDto,
} from "@/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { getWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { deleteDraftSnapshot } from "@/lib/draft-engine.client";
import { createTour } from "@/lib/services/tours.service";
import { tourKeys } from "@/lib/query-keys";

export function useDenaliTourWizardCreate() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryScope();

  return useMutation({
    mutationFn: async (input: {
      /** Exact reference from {@link prepareDenaliSubmitArtifact} — shared with submit gate. */
      submitArtifact: DenaliCreateTourWizardForm;
      workspaceFormProfile: TourFormProfile;
      themeCatalog?: readonly { id: string; name: string }[];
      sourcePresetId?: string;
      sourceTourId?: string;
      stagingTourId?: string;
    }) => {
      const projection = buildDenaliSubmitPayloadProjection(input.submitArtifact, {
        workspaceId,
      });
      let dto = mapDenaliCreateTourPayloadProjectionToDto(projection);
      dto = stripCreateTourDtoForFormProfile(input.workspaceFormProfile, dto);
      const mapped = mapCreateTourDto(
        { ...dto, sourcePresetId: input.sourcePresetId, sourceTourId: input.sourceTourId },
        { themeCatalog: input.themeCatalog },
      );
      if (input.stagingTourId?.trim()) {
        mapped.stagingTourId = input.stagingTourId.trim();
      }
      return createTour(mapped, {
        idempotencyKey: getWizardSubmitIdempotencyKey(workspaceId ?? undefined),
      });
    },
    onSuccess: async () => {
      const ws = workspaceId?.trim();
      if (ws) {
        await deleteDraftSnapshot(ws, DENALI_CREATE_DRAFT_KEY).catch(() => undefined);
      }
      if (ws) {
        await queryClient.invalidateQueries({ queryKey: tourKeys.listRoot(ws) });
      } else {
        await queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
      }
    },
  });
}
