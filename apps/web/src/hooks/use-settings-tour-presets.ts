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

import { useWorkspaceQueryScope } from "./use-workspace-query-scope";

function sortTourPresetsBySortOrder(data: SettingsTourPresetDto[]): SettingsTourPresetDto[] {
  return [...data].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function useSettingsTourPresets() {
  const tenantId = useWorkspaceQueryScope();
  return useQuery({
    queryKey: settingsTourPresetsKeys.list(tenantId ?? ""),
    queryFn: getTourPresets,
    select: sortTourPresetsBySortOrder,
    staleTime: 60_000,
    retry: false,
    enabled: Boolean(tenantId),
  });
}

export function useCreateTourPreset() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (input: CreateTourPresetPayload) => createTourPreset(input),
    onSettled: async () => {
      if (!tenantId) return;
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list(tenantId) });
    },
  });
}

export function useUpdateTourPreset() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTourPresetPayload }) => updateTourPreset(id, input),
    onSettled: async () => {
      if (!tenantId) return;
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list(tenantId) });
    },
  });
}

export function useDeleteTourPreset() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (id: string) => deleteTourPreset(id),
    onSettled: async () => {
      if (!tenantId) return;
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list(tenantId) });
    },
  });
}

export function useReorderTourPresets() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderTourPresets(itemIds),
    onSuccess: (data) => {
      if (!tenantId) return;
      queryClient.setQueryData(settingsTourPresetsKeys.list(tenantId), sortTourPresetsBySortOrder(data));
    },
    onSettled: async () => {
      if (!tenantId) return;
      await queryClient.invalidateQueries({ queryKey: settingsTourPresetsKeys.list(tenantId) });
    },
  });
}
