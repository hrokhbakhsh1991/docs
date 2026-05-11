"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import {
  useCreateTourPreset,
  useDeleteTourPreset,
  useReorderTourPresets,
  useSettingsTourPresets,
  useUpdateTourPreset,
} from "@/hooks/use-settings-tour-presets";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";
import { nextTourPresetSortOrder } from "@/lib/tour-preset-duplicate";
import { isLeaderRole, isWorkspaceOwner, useAuth } from "@/lib/auth/auth-context";

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
import { TourPresetList } from "../tour-presets/tour-preset-list";
import type { TourPresetFormParsed } from "../tour-presets/tour-preset-form";
import { TourPresetSimpleForm } from "./tour-preset-simple-form";

export function TourFormDefaultsSettingsPanel() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManageWorkspace = isLeaderRole(user?.role);
  const canDuplicatePreset = isWorkspaceOwner(user?.role);
  const readOnlyList = !canManageWorkspace;

  const themesQuery = useSettingsTourThemes();
  const themeCatalog = themesQuery.data ?? [];
  const themeNameById = useMemo(() => new Map(themeCatalog.map((row) => [row.id, row.name])), [themeCatalog]);

  const presetsQuery = useSettingsTourPresets();
  const presets = presetsQuery.data ?? [];
  const createMutation = useCreateTourPreset();
  const updateMutation = useUpdateTourPreset();
  const deleteMutation = useDeleteTourPreset();
  const reorderMutation = useReorderTourPresets();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SettingsTourPresetDto | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<SettingsTourPresetDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingsTourPresetDto | null>(null);

  const existingPresetNames = useMemo(() => presets.map((p) => p.name), [presets]);
  const duplicateSortOrder = useMemo(() => nextTourPresetSortOrder(presets), [presets]);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const openCreate = useCallback(() => {
    setEditing(null);
    setDuplicateFrom(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: SettingsTourPresetDto) => {
    setEditing(item);
    setDuplicateFrom(null);
    setFormOpen(true);
  }, []);

  const openDuplicate = useCallback((item: SettingsTourPresetDto) => {
    setEditing(null);
    setDuplicateFrom(item);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
    setDuplicateFrom(null);
  }, []);

  const onSubmitForm = useCallback(
    async (values: TourPresetFormParsed) => {
      try {
        const payload = {
          name: values.name,
          description: values.description,
          isActive: values.isActive,
          defaults: values.defaults,
          ...(values.sortOrder !== undefined ? { sortOrder: values.sortOrder } : {}),
          matchTourType: null,
          matchMainTourThemeId: null,
        };
        if (editing) {
          await updateMutation.mutateAsync({ id: editing.id, input: payload });
          showToast({ type: "success", message: t("tourFormDefaultsToastUpdated") });
        } else {
          await createMutation.mutateAsync(payload);
          showToast({ type: "success", message: t("tourFormDefaultsToastCreated") });
        }
        closeForm();
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("tourFormDefaultsToastSaveFailed"),
        });
      }
    },
    [closeForm, createMutation, editing, showToast, t, updateMutation],
  );

  const onToggleActive = useCallback(
    async (item: SettingsTourPresetDto, next: boolean) => {
      if (item.isActive === next) {
        return;
      }
      try {
        await updateMutation.mutateAsync({ id: item.id, input: { isActive: next } });
        showToast({ type: "success", message: t("tourFormDefaultsToastUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("tourFormDefaultsToastSaveFailed"),
        });
      }
    },
    [showToast, t, updateMutation],
  );

  const onReorder = useCallback(
    async (itemIds: string[]) => {
      try {
        await reorderMutation.mutateAsync(itemIds);
        showToast({ type: "success", message: t("tourFormDefaultsToastOrderUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("tourFormDefaultsToastOrderFailed"),
        });
      }
    },
    [reorderMutation, showToast, t],
  );

  const requestDelete = useCallback((item: SettingsTourPresetDto) => {
    setDeleteTarget(item);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast({ type: "success", message: t("tourFormDefaultsToastDeleted") });
      setDeleteTarget(null);
    } catch (e) {
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : t("tourFormDefaultsToastDeleteFailed"),
      });
    }
  }, [deleteMutation, deleteTarget, showToast, t]);

  const loadError = presetsQuery.error;
  const loadErrorMessage = loadError instanceof Error ? loadError.message : t("tourFormDefaultsLoadErrorTitle");

  if (loadError && presets.length === 0 && !presetsQuery.isLoading) {
    return (
      <div className={cn(formStyles.form, panelStyles.panel)}>
        <ErrorState
          title={t("tourFormDefaultsLoadErrorTitle")}
          message={loadErrorMessage}
          onRetry={() => void presetsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(formStyles.form, panelStyles.panel)}>
      <p className={panelStyles.catalogIntro}>{t("tourFormDefaultsPanelIntro")}</p>
      <div className={panelStyles.cardStack}>
        <Card>
          <CardHeader>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
              }}
            >
              <CardTitle>{t("tourFormDefaultsListTitle")}</CardTitle>
              {canManageWorkspace ? (
                <Button type="button" variant="primary" size="sm" onClick={openCreate} disabled={isMutating}>
                  {t("tourFormDefaultsAdd")}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {readOnlyList && presets.length > 0 ? (
              <p className={formStyles.readOnlyBanner}>{t("tourPresetsReadOnlyBanner")}</p>
            ) : null}
            {presetsQuery.isLoading ? <LoadingState message={t("tourFormDefaultsLoading")} /> : null}

            {!presetsQuery.isLoading && presets.length === 0 ? (
              <EmptyState
                embedded
                className={panelStyles.emptyState}
                title={t("tourFormDefaultsEmptyTitle")}
                description={readOnlyList ? t("tourFormDefaultsReadOnlyHint") : t("tourFormDefaultsEmptyDescription")}
              />
            ) : null}

            {presets.length > 0 ? (
              <TourPresetList
                items={presets}
                themeNameById={themeNameById}
                onEdit={openEdit}
                showDuplicate={canDuplicatePreset}
                onDuplicate={openDuplicate}
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
        title={
          editing ? t("tourFormDefaultsEditTitle") : duplicateFrom ? t("tourPresetsDuplicateTitle") : t("tourFormDefaultsAddTitle")
        }
        footer={null}
      >
        <TourPresetSimpleForm
          editing={editing}
          duplicateFrom={duplicateFrom}
          existingPresetNames={existingPresetNames}
          duplicateSortOrder={duplicateSortOrder}
          themeCatalog={themeCatalog}
          onSubmit={onSubmitForm}
          onCancel={closeForm}
          isPending={isMutating}
        />
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t("tourFormDefaultsDeleteConfirmTitle")}
        description={deleteTarget ? t("tourFormDefaultsDeleteConfirmDescription", { name: deleteTarget.name }) : undefined}
        confirmLabel={t("tourFormDefaultsDeleteConfirmAction")}
        cancelLabel={t("tourPresetsCancel")}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
