"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

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

  const query = useQuery({
    queryKey: settingsLocationsKeys.regions(),
    queryFn: fetchSettingsRegions,
    select: sortRegionsBySortOrder,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateRegionPayload) => createSettingsRegion(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRegionPayload }) =>
      updateSettingsRegion(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.regions() });
      const previous = queryClient.getQueryData<SettingsRegionDto[]>(settingsLocationsKeys.regions());
      queryClient.setQueryData(settingsLocationsKeys.regions(), (old: SettingsRegionDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((r) => (r.id === id ? { ...r, ...input } : r));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsLocationsKeys.regions(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions() });
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
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.regions() });
      const previous = queryClient.getQueryData<SettingsRegionDto[]>(settingsLocationsKeys.regions());
      queryClient.setQueryData(settingsLocationsKeys.regions(), nextOrdered);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsLocationsKeys.regions(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSettingsRegion(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.regions() });
      await queryClient.cancelQueries({ queryKey: settingsLocationsKeys.destinations() });
      const previousRegions = queryClient.getQueryData<SettingsRegionDto[]>(settingsLocationsKeys.regions());
      const previousDestinations = queryClient.getQueryData<SettingsDestinationDto[]>(
        settingsLocationsKeys.destinations(),
      );
      queryClient.setQueryData(settingsLocationsKeys.regions(), (old: SettingsRegionDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((r) => r.id !== id);
      });
      queryClient.setQueryData(
        settingsLocationsKeys.destinations(),
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
        queryClient.setQueryData(settingsLocationsKeys.regions(), ctx.previousRegions);
      }
      if (ctx?.previousDestinations) {
        queryClient.setQueryData(settingsLocationsKeys.destinations(), ctx.previousDestinations);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.regions() });
      await queryClient.invalidateQueries({ queryKey: settingsLocationsKeys.destinations() });
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
