"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsEquipmentKeys } from "@/lib/query-keys";

import { useWorkspaceQueryScope } from "./use-workspace-query-scope";
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
  const tenantId = useWorkspaceQueryScope();
  return useQuery({
    queryKey: settingsEquipmentKeys.list(tenantId ?? ""),
    queryFn: getEquipment,
    select: sortEquipmentBySortOrder,
    enabled: Boolean(tenantId),
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (input: CreateEquipmentPayload) => createEquipment(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list(tenantId ?? "") });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEquipmentPayload }) => updateEquipment(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: settingsEquipmentKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsEquipmentDto[]>(settingsEquipmentKeys.list(tenantId ?? ""));
      queryClient.setQueryData(settingsEquipmentKeys.list(tenantId ?? ""), (old: SettingsEquipmentDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.map((row) => (row.id === id ? { ...row, ...input } : row));
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsEquipmentKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list(tenantId ?? "") });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: settingsEquipmentKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsEquipmentDto[]>(settingsEquipmentKeys.list(tenantId ?? ""));
      queryClient.setQueryData(settingsEquipmentKeys.list(tenantId ?? ""), (old: SettingsEquipmentDto[] | undefined) => {
        if (!old) {
          return old;
        }
        return old.filter((row) => row.id !== id);
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsEquipmentKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list(tenantId ?? "") });
    },
  });
}

export function useReorderEquipment() {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  return useMutation({
    mutationFn: (itemIds: string[]) => reorderEquipment(itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: settingsEquipmentKeys.list(tenantId ?? "") });
      const previous = queryClient.getQueryData<SettingsEquipmentDto[]>(settingsEquipmentKeys.list(tenantId ?? "")) ?? [];
      const byId = new Map(previous.map((r) => [r.id, r]));
      if (itemIds.length !== previous.length || itemIds.some((id) => !byId.has(id))) {
        return { previous };
      }
      const next = itemIds.map((id, index) => {
        const row = byId.get(id)!;
        return { ...row, sortOrder: index };
      });
      queryClient.setQueryData(settingsEquipmentKeys.list(tenantId ?? ""), next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(settingsEquipmentKeys.list(tenantId ?? ""), ctx.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsEquipmentKeys.list(tenantId ?? ""), sortEquipmentBySortOrder(data));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsEquipmentKeys.list(tenantId ?? "") });
    },
  });
}
