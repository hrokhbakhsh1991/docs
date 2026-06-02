"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { RegistrationPaymentStatus } from "@repo/types";

import { invalidateWorkspaceQueries } from "@/features/registrations/invalidate-workspace-queries";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { updateRegistrationPayment } from "@/lib/services/registrations.service";

export function useUpdateRegistrationPayment(tourId: string) {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();

  return useMutation({
    mutationFn: async ({
      id,
      paymentStatus,
      paidAmount,
      expected_row_version,
    }: {
      id: string;
      paymentStatus: RegistrationPaymentStatus;
      paidAmount?: number;
      expected_row_version: number;
    }) =>
      updateRegistrationPayment(id, {
        paymentStatus,
        paidAmount,
        expected_row_version,
      }),
    onSuccess: () => {
      const scopedTenantId = tenantId?.trim();
      if (scopedTenantId) {
        invalidateWorkspaceQueries(queryClient, scopedTenantId, tourId);
      }
    },
  });
}
