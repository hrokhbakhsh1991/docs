"use client";

import { useQuery } from "@tanstack/react-query";

import type { BookingDto } from "@repo/types";

import { registrationKeys } from "@/lib/query-keys";
import {
  getRegistrationById,
  registrationDetailsEndpointAvailable,
} from "@/services/registrations";

import { useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "./use-workspace-query-scope";

export type RegistrationDetailsSource = "api" | "fallback";

export function useRegistrationDetails(
  registrationId: string | null,
  fallbackRow?: BookingDto | null,
): {
  registration: BookingDto | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  source: RegistrationDetailsSource | null;
  refetch: () => void;
} {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  const enabled =
    Boolean(registrationId?.trim()) && Boolean(tenantId?.trim()) && authBffQueryEnabled;
  const endpointAvailable = registrationDetailsEndpointAvailable();

  const q = useQuery({
    queryKey: registrationId
      ? [...registrationKeys.detail(tenantId ?? "", registrationId), "inspection"]
      : ["registrations", tenantId ?? "", "detail", "inspection", "empty"],
    enabled,
    queryFn: async ({ signal }) => {
      if (!registrationId) {
        throw new Error("Registration id is required");
      }
      if (!endpointAvailable) {
        // TODO: remove fallback path once details endpoint is guaranteed in all envs.
        if (fallbackRow) return { registration: fallbackRow, source: "fallback" as const };
        throw new Error("Registration details endpoint is unavailable");
      }
      try {
        const registration = await getRegistrationById(registrationId, { signal });
        return { registration, source: "api" as const };
      } catch (error) {
        // TODO: keep temporary fallback to table row projection until endpoint reliability is guaranteed.
        if (fallbackRow) return { registration: fallbackRow, source: "fallback" as const };
        throw error;
      }
    },
  });

  return {
    registration: q.data?.registration ?? null,
    isLoading: enabled ? q.isPending : false,
    isError: enabled ? q.isError : false,
    error: (q.error as Error | null) ?? null,
    source: q.data?.source ?? null,
    refetch: () => {
      void q.refetch();
    },
  };
}

