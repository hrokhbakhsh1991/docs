"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsGuideLanguagesKeys } from "@/lib/query-keys";
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
  return useQuery({
    queryKey: settingsGuideLanguagesKeys.list(),
    queryFn: getGuideLanguages,
    select: sortGuideLanguagesBySortOrder,
  });
}

export function useCreateGuideLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGuideLanguagePayload) => createGuideLanguage(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list() });
    },
  });
}

export function useUpdateGuideLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGuideLanguagePayload }) =>
      updateGuideLanguage(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsGuideLanguagesKeys.list() });
      const previous = queryClient.getQueryData<SettingsGuideLanguageDto[]>(settingsGuideLanguagesKeys.list());
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(), (old: SettingsGuideLanguageDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((row) => (row.id === id ? { ...row, ...input } : row));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsGuideLanguagesKeys.list(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list() });
    },
  });
}

export function useDeleteGuideLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGuideLanguage(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsGuideLanguagesKeys.list() });
      const previous = queryClient.getQueryData<SettingsGuideLanguageDto[]>(settingsGuideLanguagesKeys.list());
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(), (old: SettingsGuideLanguageDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((row) => row.id !== id);
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsGuideLanguagesKeys.list(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list() });
    },
  });
}

export function useReorderGuideLanguages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderGuideLanguages(itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: settingsGuideLanguagesKeys.list() });
      const previous = queryClient.getQueryData<SettingsGuideLanguageDto[]>(settingsGuideLanguagesKeys.list()) ?? [];
      const byId = new Map(previous.map((r) => [r.id, r]));
      if (itemIds.length !== previous.length || itemIds.some((id) => !byId.has(id))) {
        return { previous };
      }
      const next = itemIds.map((id, index) => {
        const row = byId.get(id)!;
        return { ...row, sortOrder: index };
      });
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(), next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsGuideLanguagesKeys.list(), ctx.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsGuideLanguagesKeys.list(), sortGuideLanguagesBySortOrder(data));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsGuideLanguagesKeys.list() });
    },
  });
}
