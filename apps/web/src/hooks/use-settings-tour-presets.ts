"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsTourPresetsKeys } from "@/lib/query-keys";
import {
  createTourPreset,
  deleteTourPreset,
  getTourPresets,
  reorderTourPresets,
  updateTourPreset,
  type CreateTourPresetPayload,
  type SettingsTourPresetDto,
  type UpdateTourPresetPayload,
} from "@/lib/settings-tour-presets.client";

function sortTourPresetsBySortOrder(data: SettingsTourPresetDto[]): SettingsTourPresetDto[] {
  return [...data].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function useSettingsTourPresets() {
  return useQuery({
    queryKey: settingsTourPresetsKeys.list(),
    queryFn: getTourPresets,
    select: sortTourPresetsBySortOrder,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCreateTourPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTourPresetPayload) => createTourPreset(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list() });
    },
  });
}

export function useUpdateTourPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTourPresetPayload }) => updateTourPreset(id, input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list() });
    },
  });
}

export function useDeleteTourPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTourPreset(id),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list() });
    },
  });
}

export function useReorderTourPresets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderTourPresets(itemIds),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsTourPresetsKeys.list(), sortTourPresetsBySortOrder(data));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list() });
    },
  });
}
