"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { RegistrationPaymentStatus } from "@repo/types";

import { invalidateWorkspaceQueries } from "@/features/registrations/invalidate-workspace-queries";
import { updateRegistrationPayment } from "@/lib/services/registrations.service";

export function useUpdateRegistrationPayment(tourId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      paymentStatus,
      paidAmount,
    }: {
      id: string;
      paymentStatus: RegistrationPaymentStatus;
      paidAmount?: number;
    }) => updateRegistrationPayment(id, { paymentStatus, paidAmount }),
    onSuccess: () => {
      invalidateWorkspaceQueries(queryClient, tourId);
    },
  });
}
