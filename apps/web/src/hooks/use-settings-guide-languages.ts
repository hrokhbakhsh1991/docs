"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsGuideLanguagesKeys } from "@/lib/query-keys";

import { useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "./use-workspace-query-scope";
import {
  createGuideLanguage,
  deleteGuideLanguage,
  getGuideLanguages,
  reorderGuideLanguages,
  updateGuideLanguage,
  type CreateGuideLanguagePayload,
  type SettingsGuideLanguageDto,
  type UpdateGuideLanguagePayload,
} from "@/lib/settings-guide-languages.client";

function sortGuideLanguagesBySortOrder(data: SettingsGuideLanguageDto[]): SettingsGuideLanguageDto[] {
  return [...data].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function useSettingsGuideLanguages() {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  return useQuery({
    queryKey: settingsGuideLanguagesKeys.list(tenantId ?? ""),
    queryFn: getGuideLanguages,
    select: sortGuideLanguagesBySortOrder,
    enabled: authBffQueryEnabled,
  });
}

export function useCreateGuideLanguage() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (input: CreateGuideLanguagePayload) => createGuideLanguage(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list(tenantId ?? "") });
    },
  });
}

export function useUpdateGuideLanguage() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGuideLanguagePayload }) =>
      updateGuideLanguage(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsGuideLanguagesKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsGuideLanguageDto[]>(settingsGuideLanguagesKeys.list(tenantId ?? ""));
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(tenantId ?? ""), (old: SettingsGuideLanguageDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((row) => (row.id === id ? { ...row, ...input } : row));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsGuideLanguagesKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list(tenantId ?? "") });
    },
  });
}

export function useDeleteGuideLanguage() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (id: string) => deleteGuideLanguage(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsGuideLanguagesKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsGuideLanguageDto[]>(settingsGuideLanguagesKeys.list(tenantId ?? ""));
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(tenantId ?? ""), (old: SettingsGuideLanguageDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((row) => row.id !== id);
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsGuideLanguagesKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list(tenantId ?? "") });
    },
  });
}

export function useReorderGuideLanguages() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderGuideLanguages(itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: settingsGuideLanguagesKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsGuideLanguageDto[]>(settingsGuideLanguagesKeys.list(tenantId ?? "")) ?? [];
      const byId = new Map(previous.map((r) => [r.id, r]));
      if (itemIds.length !== previous.length || itemIds.some((id) => !byId.has(id))) {
        return { previous };
      }
      const next = itemIds.map((id, index) => {
        const row = byId.get(id)!;
        return { ...row, sortOrder: index };
      });
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(tenantId ?? ""), next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsGuideLanguagesKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(tenantId ?? ""), sortGuideLanguagesBySortOrder(data));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list(tenantId ?? "") });
    },
  });
}
