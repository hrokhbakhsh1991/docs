"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import {
  useCreateTourTheme,
  useDeleteTourTheme,
  useReorderTourThemes,
  useSettingsTourThemes,
  useUpdateTourTheme,
} from "@/hooks/use-settings-tour-themes";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";
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
import { TourThemeForm, type TourThemeFormParsed } from "./tour-theme-form";
import { TourThemeList } from "./tour-theme-list";

export function TourThemesSettingsPanel() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManageWorkspace = isLeaderRole(user?.role);
  const readOnlyList = !canManageWorkspace;

  const themesQuery = useSettingsTourThemes();
  const themes = themesQuery.data ?? [];
  const createMutation = useCreateTourTheme();
  const updateMutation = useUpdateTourTheme();
  const deleteMutation = useDeleteTourTheme();
  const reorderMutation = useReorderTourThemes();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SettingsTourThemeDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingsTourThemeDto | null>(null);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: SettingsTourThemeDto) => {
    setEditing(item);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  const onSubmitForm = useCallback(
    async (values: TourThemeFormParsed) => {
      try {
        const payload = {
          name: values.name,
          slug: values.slug,
          description: values.description,
          isActive: values.isActive,
          ...(values.sortOrder !== undefined ? { sortOrder: values.sortOrder } : {}),
        };
        if (editing) {
          await updateMutation.mutateAsync({ id: editing.id, input: payload });
          showToast({ type: "success", message: t("tourThemesToastUpdated") });
        } else {
          await createMutation.mutateAsync(payload);
          showToast({ type: "success", message: t("tourThemesToastCreated") });
        }
        closeForm();
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("tourThemesToastSaveFailed"),
        });
      }
    },
    [closeForm, createMutation, editing, showToast, t, updateMutation],
  );

  const onToggleActive = useCallback(
    async (item: SettingsTourThemeDto, next: boolean) => {
      if (item.isActive === next) {
        return;
      }
      try {
        await updateMutation.mutateAsync({ id: item.id, input: { isActive: next } });
        showToast({ type: "success", message: t("tourThemesToastUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("tourThemesToastSaveFailed"),
        });
      }
    },
    [showToast, t, updateMutation],
  );

  const onReorder = useCallback(
    async (itemIds: string[]) => {
      try {
        await reorderMutation.mutateAsync(itemIds);
        showToast({ type: "success", message: t("tourThemesToastOrderUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("tourThemesToastOrderFailed"),
        });
      }
    },
    [reorderMutation, showToast, t],
  );

  const requestDelete = useCallback((item: SettingsTourThemeDto) => {
    setDeleteTarget(item);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast({ type: "success", message: t("tourThemesToastDeleted") });
      setDeleteTarget(null);
    } catch (e) {
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : t("tourThemesToastDeleteFailed"),
      });
    }
  }, [deleteMutation, deleteTarget, showToast, t]);

  const loadError = themesQuery.error;
  const loadErrorMessage = loadError instanceof Error ? loadError.message : t("tourThemesLoadErrorTitle");

  if (loadError && themes.length === 0 && !themesQuery.isLoading) {
    return (
      <div className={cn(formStyles.form, panelStyles.panel)}>
        <ErrorState
          title={t("tourThemesLoadErrorTitle")}
          message={loadErrorMessage}
          onRetry={() => void themesQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(formStyles.form, panelStyles.panel)}>
      <p className={panelStyles.catalogIntro}>{t("tourThemesPanelIntro")}</p>
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
              <CardTitle>{t("tourThemesListTitle")}</CardTitle>
              {canManageWorkspace ? (
                <Button type="button" variant="primary" size="sm" onClick={openCreate} disabled={isMutating}>
                  {t("tourThemesAdd")}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {readOnlyList && themes.length > 0 ? (
              <p className={formStyles.readOnlyBanner}>{t("tourThemesReadOnlyBanner")}</p>
            ) : null}
            {themesQuery.isLoading ? <LoadingState message={t("tourThemesLoading")} /> : null}

            {!themesQuery.isLoading && themes.length === 0 ? (
              <EmptyState
                embedded
                className={panelStyles.emptyState}
                title={t("tourThemesEmptyTitle")}
                description={readOnlyList ? t("tourThemesReadOnlyHint") : t("tourThemesEmptyDescription")}
              />
            ) : null}

            {themes.length > 0 ? (
              <TourThemeList
                items={themes}
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
        title={editing ? t("tourThemesEditTitle") : t("tourThemesAddTitle")}
        footer={null}
      >
        <TourThemeForm editing={editing} onSubmit={onSubmitForm} onCancel={closeForm} isPending={isMutating} />
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t("tourThemesDeleteConfirmTitle")}
        description={
          deleteTarget ? t("tourThemesDeleteConfirmDescription", { name: deleteTarget.name }) : undefined
        }
        confirmLabel={t("tourThemesDeleteConfirmAction")}
        cancelLabel={t("tourThemesCancel")}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
