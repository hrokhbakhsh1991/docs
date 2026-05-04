"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { RegistrationStatus } from "@repo/types";

import { invalidateWorkspaceQueries } from "@/features/registrations/invalidate-workspace-queries";
import { updateRegistrationStatus } from "@/lib/services/registrations.service";

export function useUpdateRegistrationStatus(tourId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, targetStatus }: { id: string; targetStatus: RegistrationStatus }) =>
      updateRegistrationStatus(id, targetStatus),
    onSuccess: () => {
      invalidateWorkspaceQueries(queryClient, tourId);
    },
  });
}
