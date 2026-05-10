"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import {
  useCreateGuideLanguage,
  useDeleteGuideLanguage,
  useReorderGuideLanguages,
  useSettingsGuideLanguages,
  useUpdateGuideLanguage,
} from "@/hooks/use-settings-guide-languages";
import type { SettingsGuideLanguageDto } from "@/lib/settings-guide-languages.client";
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
import { GuideLanguageForm, type GuideLanguageFormParsed } from "./guide-language-form";
import { GuideLanguageList } from "./guide-language-list";

export function GuideLanguagesSettingsPanel() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManageWorkspace = isLeaderRole(user?.role);
  const readOnlyList = !canManageWorkspace;

  const languagesQuery = useSettingsGuideLanguages();
  const languages = languagesQuery.data ?? [];
  const createMutation = useCreateGuideLanguage();
  const updateMutation = useUpdateGuideLanguage();
  const deleteMutation = useDeleteGuideLanguage();
  const reorderMutation = useReorderGuideLanguages();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SettingsGuideLanguageDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingsGuideLanguageDto | null>(null);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: SettingsGuideLanguageDto) => {
    setEditing(item);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  const onSubmitForm = useCallback(
    async (values: GuideLanguageFormParsed) => {
      try {
        const payload = {
          name: values.name,
          slug: values.slug,
          isActive: values.isActive,
          ...(values.sortOrder !== undefined ? { sortOrder: values.sortOrder } : {}),
        };
        if (editing) {
          await updateMutation.mutateAsync({ id: editing.id, input: payload });
          showToast({ type: "success", message: t("guideLanguagesToastUpdated") });
        } else {
          await createMutation.mutateAsync(payload);
          showToast({ type: "success", message: t("guideLanguagesToastCreated") });
        }
        closeForm();
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("guideLanguagesToastSaveFailed"),
        });
      }
    },
    [closeForm, createMutation, editing, showToast, t, updateMutation],
  );

  const onToggleActive = useCallback(
    async (item: SettingsGuideLanguageDto, next: boolean) => {
      if (item.isActive === next) {
        return;
      }
      try {
        await updateMutation.mutateAsync({ id: item.id, input: { isActive: next } });
        showToast({ type: "success", message: t("guideLanguagesToastUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("guideLanguagesToastSaveFailed"),
        });
      }
    },
    [showToast, t, updateMutation],
  );

  const onReorder = useCallback(
    async (itemIds: string[]) => {
      try {
        await reorderMutation.mutateAsync(itemIds);
        showToast({ type: "success", message: t("guideLanguagesToastOrderUpdated") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("guideLanguagesToastOrderFailed"),
        });
      }
    },
    [reorderMutation, showToast, t],
  );

  const requestDelete = useCallback((item: SettingsGuideLanguageDto) => {
    setDeleteTarget(item);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast({ type: "success", message: t("guideLanguagesToastDeleted") });
      setDeleteTarget(null);
    } catch (e) {
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : t("guideLanguagesToastDeleteFailed"),
      });
    }
  }, [deleteMutation, deleteTarget, showToast, t]);

  const loadError = languagesQuery.error;
  const loadErrorMessage = loadError instanceof Error ? loadError.message : t("guideLanguagesLoadErrorTitle");

  if (loadError && languages.length === 0 && !languagesQuery.isLoading) {
    return (
      <div className={cn(formStyles.form, panelStyles.panel)}>
        <ErrorState
          title={t("guideLanguagesLoadErrorTitle")}
          message={loadErrorMessage}
          onRetry={() => void languagesQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(formStyles.form, panelStyles.panel)}>
      <p className={panelStyles.catalogIntro}>{t("guideLanguagesPanelIntro")}</p>
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
              <CardTitle>{t("guideLanguagesListTitle")}</CardTitle>
              {canManageWorkspace ? (
                <Button type="button" variant="primary" size="sm" onClick={openCreate} disabled={isMutating}>
                  {t("guideLanguagesAdd")}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {readOnlyList && languages.length > 0 ? (
              <p className={formStyles.readOnlyBanner}>{t("guideLanguagesReadOnlyBanner")}</p>
            ) : null}
            {languagesQuery.isLoading ? <LoadingState message={t("guideLanguagesLoading")} /> : null}

            {!languagesQuery.isLoading && languages.length === 0 ? (
              <EmptyState
                embedded
                className={panelStyles.emptyState}
                title={t("guideLanguagesEmptyTitle")}
                description={readOnlyList ? t("guideLanguagesReadOnlyHint") : t("guideLanguagesEmptyDescription")}
              />
            ) : null}

            {languages.length > 0 ? (
              <GuideLanguageList
                items={languages}
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
        title={editing ? t("guideLanguagesEditTitle") : t("guideLanguagesAddTitle")}
        footer={null}
      >
        <GuideLanguageForm editing={editing} onSubmit={onSubmitForm} onCancel={closeForm} isPending={isMutating} />
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t("guideLanguagesDeleteConfirmTitle")}
        description={
          deleteTarget ? t("guideLanguagesDeleteConfirmDescription", { name: deleteTarget.name }) : undefined
        }
        confirmLabel={t("guideLanguagesDeleteConfirmAction")}
        cancelLabel={t("guideLanguagesCancel")}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
