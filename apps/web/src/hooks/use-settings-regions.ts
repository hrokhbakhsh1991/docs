"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";


import { useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "./use-workspace-query-scope";
import { settingsLocationsKeys } from "@/lib/query-keys";
import {
  createSettingsRegion,
  deleteSettingsRegion,
  fetchSettingsRegions,
  updateSettingsRegion,
  type CreateRegionPayload,
  type SettingsDestinationDto,
  type SettingsRegionDto,
  type UpdateRegionPayload,
} from "@/lib/settings-locations-client";

function sortRegionsBySortOrder(data: SettingsRegionDto[]): SettingsRegionDto[] {
  return [...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function useSettingsRegions() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);

  const query = useQuery({
    queryKey: settingsLocationsKeys.regions(tenantId ?? ""),
    queryFn: fetchSettingsRegions,
    select: sortRegionsBySortOrder,
    enabled: authBffQueryEnabled,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateRegionPayload) => createSettingsRegion(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions(tenantId ?? "") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRegionPayload }) =>
      updateSettingsRegion(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.regions(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsRegionDto[]>(settingsLocationsKeys.regions(tenantId ?? ""));
      queryClient.setQueryData(settingsLocationsKeys.regions(tenantId ?? ""), (old: SettingsRegionDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((r) => (r.id === id ? { ...r, ...input } : r));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsLocationsKeys.regions(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions(tenantId ?? "") });
    },
  });

  const reorderRegionsMutation = useMutation({
    mutationFn: async ({
      nextOrdered: _nextOrdered,
      patches,
    }: {
      nextOrdered: SettingsRegionDto[];
      patches: { id: string; sortOrder: number }[];
    }) => {
      if (patches.length === 0) {
        return;
      }
      await Promise.all(
        patches.map((p) => updateSettingsRegion(p.id, { sortOrder: p.sortOrder })),
      );
    },
    onMutate: async ({ nextOrdered }) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.regions(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsRegionDto[]>(settingsLocationsKeys.regions(tenantId ?? ""));
      queryClient.setQueryData(settingsLocationsKeys.regions(tenantId ?? ""), nextOrdered);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsLocationsKeys.regions(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions(tenantId ?? "") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSettingsRegion(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.regions(tenantId ?? "") });
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
      const previousRegions = queryClient.getQueryData<SettingsRegionDto[]>(settingsLocationsKeys.regions(tenantId ?? ""));
      const previousDestinations = queryClient.getQueryData<SettingsDestinationDto[]>(
        settingsLocationsKeys.destinations(tenantId ?? ""),
      );
      queryClient.setQueryData(settingsLocationsKeys.regions(tenantId ?? ""), (old: SettingsRegionDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((r) => r.id !== id);
      });
      queryClient.setQueryData(
        settingsLocationsKeys.destinations(tenantId ?? ""),
        (old: SettingsDestinationDto[] | undefined) => {
          if (!old) {
            return old;
          }
          return old.filter((d) => d.regionId !== id);
        },
      );
      return { previousRegions, previousDestinations };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previousRegions) {
        queryClient.setQueryData(settingsLocationsKeys.regions(tenantId ?? ""), ctx.previousRegions);
      }
      if (ctx?.previousDestinations) {
        queryClient.setQueryData(settingsLocationsKeys.destinations(tenantId ?? ""), ctx.previousDestinations);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions(tenantId ?? "") });
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.destinations(tenantId ?? "") });
    },
  });

  const updateRegion = useCallback(
    (id: string, input: UpdateRegionPayload) => updateMutation.mutateAsync({ id, input }),
    [updateMutation],
  );

  const reorderRegions = useCallback(
    (nextOrdered: SettingsRegionDto[], patches: { id: string; sortOrder: number }[]) => {
      if (patches.length === 0) {
        return Promise.resolve();
      }
      return reorderRegionsMutation.mutateAsync({ nextOrdered, patches });
    },
    [reorderRegionsMutation],
  );

  return {
    regions: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
    createRegion: createMutation.mutateAsync,
    updateRegion,
    deleteRegion: deleteMutation.mutateAsync,
    reorderRegions,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      reorderRegionsMutation.isPending,
  };
}
