"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import {
  useCreateEquipment,
  useDeleteEquipment,
  useReorderEquipment,
  useSettingsEquipment,
  useUpdateEquipment,
} from "@/hooks/use-settings-equipment";
import type { SettingsEquipmentDto } from "@/lib/settings-equipment.client";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  cn,
  useToast,
} from "@tour/ui";

import formStyles from "../settings-profile-form.module.css";
import panelStyles from "../locations/locations-settings-panel.module.css";
import { EquipmentForm, type EquipmentFormParsed } from "./equipment-form";
import { EquipmentList } from "./equipment-list";

export function EquipmentSettingsPanel() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManageWorkspace = isLeaderRole(user?.role);
  const readOnlyList = !canManageWorkspace;

  const equipmentQuery = useSettingsEquipment();
  const equipment = equipmentQuery.data ?? [];
  const createMutation = useCreateEquipment();
  const updateMutation = useUpdateEquipment();
  const deleteMutation = useDeleteEquipment();
  const reorderMutation = useReorderEquipment();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SettingsEquipmentDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingsEquipmentDto | null>(null);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: SettingsEquipmentDto) => {
    setEditing(item);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  const onSubmitForm = useCallback(
    async (values: EquipmentFormParsed) => {
      try {
        const payload = {
          name: values.name,
          slug: values.slug,
          compatibleCategories: values.compatibleCategories,
          description: values.description,
          icon: values.icon,
          isActive: values.isActive,
          ...(values.sortOrder !== undefined ? { sortOrder: values.sortOrder } : {}),
        };
        if (editing) {
          await updateMutation.mutateAsync({ id: editing.id, input: payload });
          showToast({ type: "success", message: t("equipmentToastUpdated") });
        } else {
          await createMutation.mutateAsync(payload);
          showToast({ type: "success", message: t("equipmentToastCreated") });
        }
        closeForm();
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("equipmentToastSaveFailed"),
        });
      }
    },
    [closeForm, createMutation, editing, showToast, t, updateMutation],
  );

  const onToggleActive = useCallback(
    async (item: SettingsEquipmentDto, next: boolean) => {
      if (item.isActive === next) {
        return;
      }
      try {
        await updateMutation.mutateAsync({ id: item.id, input: { isActive: next } });
        showToast({ type: "success", message: t("equipmentToastUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("equipmentToastSaveFailed"),
        });
      }
    },
    [showToast, t, updateMutation],
  );

  const onReorder = useCallback(
    async (itemIds: string[]) => {
      try {
        await reorderMutation.mutateAsync(itemIds);
        showToast({ type: "success", message: t("equipmentToastOrderUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("equipmentToastOrderFailed"),
        });
      }
    },
    [reorderMutation, showToast, t],
  );

  const requestDelete = useCallback((item: SettingsEquipmentDto) => {
    setDeleteTarget(item);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast({ type: "success", message: t("equipmentToastDeleted") });
      setDeleteTarget(null);
    } catch (e) {
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : t("equipmentToastDeleteFailed"),
      });
    }
  }, [deleteMutation, deleteTarget, showToast, t]);

  const loadError = equipmentQuery.error;
  const loadErrorMessage = loadError instanceof Error ? loadError.message : t("equipmentLoadErrorTitle");

  if (loadError && equipment.length === 0 && !equipmentQuery.isLoading) {
    return (
      <div className={cn(formStyles.form, panelStyles.panel)}>
        <ErrorState
          title={t("equipmentLoadErrorTitle")}
          message={loadErrorMessage}
          onRetry={() => void equipmentQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(formStyles.form, panelStyles.panel)}>
      <p className={panelStyles.catalogIntro}>{t("equipmentPanelIntro")}</p>
      <div className={panelStyles.cardStack}>
        <Card>
          <CardHeader>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <CardTitle>{t("equipmentListTitle")}</CardTitle>
              {canManageWorkspace ? (
                <Button type="button" variant="primary" size="sm" onClick={openCreate} disabled={isMutating}>
                  {t("equipmentAdd")}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {readOnlyList && equipment.length > 0 ? (
              <p className={formStyles.readOnlyBanner}>{t("equipmentReadOnlyBanner")}</p>
            ) : null}
            {equipmentQuery.isLoading ? (
              <LoadingState message={t("equipmentLoading")} />
            ) : null}

            {!equipmentQuery.isLoading && equipment.length === 0 ? (
              <EmptyState
                embedded
                className={panelStyles.emptyState}
                title={t("equipmentEmptyTitle")}
                description={readOnlyList ? t("equipmentReadOnlyHint") : t("equipmentEmptyDescription")}
              />
            ) : null}

            {equipment.length > 0 ? (
              <EquipmentList
                items={equipment}
                onEdit={openEdit}
                onDelete={requestDelete}
                onToggleActive={onToggleActive}
                onReorder={onReorder}
                mutating={isMutating}
                readOnly={readOnlyList}
              />
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? t("equipmentEditTitle") : t("equipmentAddTitle")}
        footer={null}
      >
        <EquipmentForm editing={editing} onSubmit={onSubmitForm} onCancel={closeForm} isPending={isMutating} />
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t("equipmentDeleteConfirmTitle")}
        description={
          deleteTarget
            ? t("equipmentDeleteConfirmDescription", { name: deleteTarget.name })
            : undefined
        }
        confirmLabel={t("equipmentDeleteConfirmAction")}
        cancelLabel={t("equipmentCancel")}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
