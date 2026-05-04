"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateWorkspaceQueries } from "@/features/registrations/invalidate-workspace-queries";
import { convertWaitlistItem } from "@/lib/services/registrations.service";

export function useConvertWaitlistItem(tourId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (waitlistItemId: string) => convertWaitlistItem(waitlistItemId),
    onSuccess: () => {
      invalidateWorkspaceQueries(queryClient, tourId);
    },
  });
}
