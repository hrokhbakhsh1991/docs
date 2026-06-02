"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";


import { useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "./use-workspace-query-scope";
import { settingsLocationsKeys } from "@/lib/query-keys";
import {
  createSettingsDestination,
  deleteSettingsDestination,
  fetchSettingsDestinations,
  updateSettingsDestination,
  type CreateDestinationPayload,
  type SettingsDestinationDto,
  type UpdateDestinationPayload,
} from "@/lib/settings-locations-client";

function sortDestinationsBySortOrder(data: SettingsDestinationDto[]): SettingsDestinationDto[] {
  return [...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function useSettingsDestinations() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);

  const query = useQuery({
    queryKey: settingsLocationsKeys.destinations(tenantId ?? ""),
    queryFn: fetchSettingsDestinations,
    select: sortDestinationsBySortOrder,
    enabled: authBffQueryEnabled,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateDestinationPayload) => createSettingsDestination(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDestinationPayload }) =>
      updateSettingsDestination(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsDestinationDto[]>(settingsLocationsKeys.destinations(tenantId ?? ""));
      queryClient.setQueryData(
        settingsLocationsKeys.destinations(tenantId ?? ""),
        (old: SettingsDestinationDto[] | undefined) => {
          if (!old) {
            return old;
          }
          return old.map((d) => (d.id === id ? { ...d, ...input } : d));
        },
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsLocationsKeys.destinations(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
    },
  });

  const reorderDestinationsMutation = useMutation({
    mutationFn: async ({
      nextDestinations: _nextDestinations,
      patches,
    }: {
      nextDestinations: SettingsDestinationDto[];
      patches: { id: string; sortOrder: number }[];
    }) => {
      if (patches.length === 0) {
        return;
      }
      await Promise.all(
        patches.map((p) => updateSettingsDestination(p.id, { sortOrder: p.sortOrder })),
      );
    },
    onMutate: async ({ nextDestinations }) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsDestinationDto[]>(
        settingsLocationsKeys.destinations(tenantId ?? ""),
      );
      queryClient.setQueryData(settingsLocationsKeys.destinations(tenantId ?? ""), nextDestinations);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsLocationsKeys.destinations(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSettingsDestination(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsDestinationDto[]>(settingsLocationsKeys.destinations(tenantId ?? ""));
      queryClient.setQueryData(
        settingsLocationsKeys.destinations(tenantId ?? ""),
        (old: SettingsDestinationDto[] | undefined) => {
          if (!old) {
            return old;
          }
          return old.filter((d) => d.id !== id);
        },
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsLocationsKeys.destinations(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
    },
  });

  const updateDestination = useCallback(
    (id: string, input: UpdateDestinationPayload) => updateMutation.mutateAsync({ id, input }),
    [updateMutation],
  );

  const reorderDestinations = useCallback(
    (nextDestinations: SettingsDestinationDto[], patches: { id: string; sortOrder: number }[]) => {
      if (patches.length === 0) {
        return Promise.resolve();
      }
      return reorderDestinationsMutation.mutateAsync({ nextDestinations, patches });
    },
    [reorderDestinationsMutation],
  );

  return {
    destinations: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
    createDestination: createMutation.mutateAsync,
    updateDestination,
    deleteDestination: deleteMutation.mutateAsync,
    reorderDestinations,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      reorderDestinationsMutation.isPending,
  };
}
