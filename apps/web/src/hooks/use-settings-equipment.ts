"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsEquipmentKeys } from "@/lib/query-keys";
import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  reorderEquipment,
  updateEquipment,
  type CreateEquipmentPayload,
  type SettingsEquipmentDto,
  type UpdateEquipmentPayload,
} from "@/lib/settings-equipment.client";

function sortEquipmentBySortOrder(data: SettingsEquipmentDto[]): SettingsEquipmentDto[] {
  return [...data].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function useSettingsEquipment() {
  return useQuery({
    queryKey: settingsEquipmentKeys.list(),
    queryFn: getEquipment,
    select: sortEquipmentBySortOrder,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEquipmentPayload) => createEquipment(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list() });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEquipmentPayload }) => updateEquipment(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsEquipmentKeys.list() });
      const previous = queryClient.getQueryData<SettingsEquipmentDto[]>(settingsEquipmentKeys.list());
      queryClient.setQueryData(settingsEquipmentKeys.list(), (old: SettingsEquipmentDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((row) => (row.id === id ? { ...row, ...input } : row));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsEquipmentKeys.list(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list() });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsEquipmentKeys.list() });
      const previous = queryClient.getQueryData<SettingsEquipmentDto[]>(settingsEquipmentKeys.list());
      queryClient.setQueryData(settingsEquipmentKeys.list(), (old: SettingsEquipmentDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((row) => row.id !== id);
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsEquipmentKeys.list(), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list() });
    },
  });
}

export function useReorderEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderEquipment(itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: settingsEquipmentKeys.list() });
      const previous = queryClient.getQueryData<SettingsEquipmentDto[]>(settingsEquipmentKeys.list()) ?? [];
      const byId = new Map(previous.map((r) => [r.id, r]));
      if (itemIds.length !== previous.length || itemIds.some((id) => !byId.has(id))) {
        return { previous };
      }
      const next = itemIds.map((id, index) => {
        const row = byId.get(id)!;
        return { ...row, sortOrder: index };
      });
      queryClient.setQueryData(settingsEquipmentKeys.list(), next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsEquipmentKeys.list(), ctx.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsEquipmentKeys.list(), sortEquipmentBySortOrder(data));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list() });
    },
  });
}
