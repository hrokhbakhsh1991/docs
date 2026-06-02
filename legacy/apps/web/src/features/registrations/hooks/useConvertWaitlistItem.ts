"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { convertWaitlistItem } from "@/lib/services/registrations.service";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { registrationKeys, tourKeys } from "@/lib/query-keys";

export function useConvertWaitlistItem(tourId: string) {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();

  return useMutation({
    mutationFn: (waitlistItemId: string) => convertWaitlistItem(waitlistItemId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: registrationKeys.tourRegistrations(tenantId?.trim() ?? "", tourId),
        }),
        queryClient.refetchQueries({
          queryKey: registrationKeys.tourWaitlist(tenantId?.trim() ?? "", tourId),
        }),
      ]);
      void queryClient.invalidateQueries({
        queryKey: tourKeys.detail(tenantId?.trim() ?? "", tourId),
      });
    },
  });
}
