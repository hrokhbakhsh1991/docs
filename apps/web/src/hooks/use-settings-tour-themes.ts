"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsTourThemesKeys } from "@/lib/query-keys";
import {
  createTourTheme,
  deleteTourTheme,
  getTourThemes,
  reorderTourThemes,
  updateTourTheme,
  type CreateTourThemePayload,
  type SettingsTourThemeDto,
  type UpdateTourThemePayload,
} from "@/lib/settings-tour-themes.client";

function sortTourThemesBySortOrder(data: SettingsTourThemeDto[]): SettingsTourThemeDto[] {
  return [...data].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function useSettingsTourThemes() {
  return useQuery({
    queryKey: settingsTourThemesKeys.list(),
    queryFn: getTourThemes,
    select: sortTourThemesBySortOrder,
  });
}

export function useCreateTourTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTourThemePayload) => createTourTheme(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list() });
    },
  });
}

export function useUpdateTourTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTourThemePayload }) => updateTourTheme(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsTourThemesKeys.list() });
      const previous = queryClient.getQueryData<SettingsTourThemeDto[]>(settingsTourThemesKeys.list());
      queryClient.setQueryData(settingsTourThemesKeys.list(), (old: SettingsTourThemeDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((row) => (row.id === id ? { ...row, ...input } : row));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsTourThemesKeys.list(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list() });
    },
  });
}

export function useDeleteTourTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTourTheme(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsTourThemesKeys.list() });
      const previous = queryClient.getQueryData<SettingsTourThemeDto[]>(settingsTourThemesKeys.list());
      queryClient.setQueryData(settingsTourThemesKeys.list(), (old: SettingsTourThemeDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((row) => row.id !== id);
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsTourThemesKeys.list(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list() });
    },
  });
}

export function useReorderTourThemes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderTourThemes(itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: settingsTourThemesKeys.list() });
      const previous = queryClient.getQueryData<SettingsTourThemeDto[]>(settingsTourThemesKeys.list()) ?? [];
      const byId = new Map(previous.map((r) => [r.id, r]));
      if (itemIds.length !== previous.length || itemIds.some((id) => !byId.has(id))) {
        return { previous };
      }
      const next = itemIds.map((id, index) => {
        const row = byId.get(id)!;
        return { ...row, sortOrder: index };
      });
      queryClient.setQueryData(settingsTourThemesKeys.list(), next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsTourThemesKeys.list(), ctx.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsTourThemesKeys.list(), sortTourThemesBySortOrder(data));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list() });
    },
  });
}
