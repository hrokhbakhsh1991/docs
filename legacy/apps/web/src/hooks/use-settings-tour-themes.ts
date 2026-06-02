"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsTourThemesKeys } from "@/lib/query-keys";

import { useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "./use-workspace-query-scope";
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
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  return useQuery({
    queryKey: settingsTourThemesKeys.list(tenantId ?? ""),
    queryFn: getTourThemes,
    select: sortTourThemesBySortOrder,
    enabled: authBffQueryEnabled,
  });
}

export function useCreateTourTheme() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (input: CreateTourThemePayload) => createTourTheme(input),
    onSettled: async () => {
      if (!tenantId) return;
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list(tenantId) });
    },
  });
}

export function useUpdateTourTheme() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTourThemePayload }) => updateTourTheme(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsTourThemesKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsTourThemeDto[]>(settingsTourThemesKeys.list(tenantId ?? ""));
      queryClient.setQueryData(settingsTourThemesKeys.list(tenantId ?? ""), (old: SettingsTourThemeDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((row) => (row.id === id ? { ...row, ...input } : row));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsTourThemesKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list(tenantId ?? "") });
    },
  });
}

export function useDeleteTourTheme() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (id: string) => deleteTourTheme(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsTourThemesKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsTourThemeDto[]>(settingsTourThemesKeys.list(tenantId ?? ""));
      queryClient.setQueryData(settingsTourThemesKeys.list(tenantId ?? ""), (old: SettingsTourThemeDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((row) => row.id !== id);
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsTourThemesKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list(tenantId ?? "") });
    },
  });
}

export function useReorderTourThemes() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderTourThemes(itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: settingsTourThemesKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsTourThemeDto[]>(settingsTourThemesKeys.list(tenantId ?? "")) ?? [];
      const byId = new Map(previous.map((r) => [r.id, r]));
      if (itemIds.length !== previous.length || itemIds.some((id) => !byId.has(id))) {
        return { previous };
      }
      const next = itemIds.map((id, index) => {
        const row = byId.get(id)!;
        return { ...row, sortOrder: index };
      });
      queryClient.setQueryData(settingsTourThemesKeys.list(tenantId ?? ""), next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsTourThemesKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsTourThemesKeys.list(tenantId ?? ""), sortTourThemesBySortOrder(data));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsTourThemesKeys.list(tenantId ?? "") });
    },
  });
}
