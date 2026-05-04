"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { convertWaitlistItem } from "@/lib/services/registrations.service";
import { registrationKeys, tourKeys } from "@/lib/query-keys";

export function useConvertWaitlistItem(tourId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (waitlistItemId: string) => convertWaitlistItem(waitlistItemId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: registrationKeys.tourRegistrations(tourId) }),
        queryClient.refetchQueries({ queryKey: registrationKeys.tourWaitlist(tourId) }),
      ]);
      void queryClient.invalidateQueries({ queryKey: tourKeys.detail(tourId) });
    },
  });
}
