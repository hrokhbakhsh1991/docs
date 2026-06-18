"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { DenaliConfirmDialog } from "@/admin/patterns/denali-confirm-dialog";
import { useDenaliConfirmDialog } from "@/admin/patterns/use-denali-confirm-dialog";

import type { WorkspaceDraftHookResult } from "./workspace-draft-types";
import { runDenaliWizardClearDraftSequence } from "./run-denali-wizard-clear-draft-sequence";

type UseDenaliWizardClearDraftOptions<T> = {
  readonly draftSync: Pick<
    WorkspaceDraftHookResult<T>,
    "clearDraftAndReset" | "navLocked" | "status"
  >;
  readonly buildResetEnvelope: () => T;
  readonly onAfterClear?: () => void;
  readonly disabled?: boolean;
};

export function useDenaliWizardClearDraft<T>({
  draftSync,
  buildResetEnvelope,
  onAfterClear,
  disabled = false,
}: UseDenaliWizardClearDraftOptions<T>) {
  const t = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const confirm = useDenaliConfirmDialog();
  const [clearDraftPending, setClearDraftPending] = useState(false);
  const [clearDraftError, setClearDraftError] = useState<string | null>(null);

  const executeClearDraft = useCallback(async () => {
    setClearDraftPending(true);
    setClearDraftError(null);
    try {
      await runDenaliWizardClearDraftSequence({
        clearDraftAndReset: (reset) => draftSync.clearDraftAndReset(reset),
        buildResetEnvelope,
        onAfterClear,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "WORKSPACE_DRAFT_CLEAR_FAILED";
      setClearDraftError(t("clearDraftError", { error: message }));
    } finally {
      setClearDraftPending(false);
    }
  }, [buildResetEnvelope, draftSync, onAfterClear, t]);

  const requestClearDraft = useCallback(() => {
    if (
      disabled ||
      clearDraftPending ||
      draftSync.navLocked ||
      draftSync.status === "SYNCING"
    ) {
      return;
    }
    confirm.requestConfirmation(() => {
      void executeClearDraft();
    });
  }, [
    clearDraftPending,
    confirm,
    disabled,
    draftSync.navLocked,
    draftSync.status,
    executeClearDraft,
  ]);

  const clearDraftConfirmDialog = (
    <DenaliConfirmDialog
      open={confirm.open}
      onOpenChange={confirm.handleOpenChange}
      title={t("clearDraftConfirmTitle")}
      description={t("clearDraftConfirm")}
      cancelLabel={tCommon("cancel")}
      confirmLabel={t("clearDraft")}
      confirmPending={clearDraftPending}
      onConfirm={confirm.handleConfirm}
      confirmVariant="destructive"
      testIdPrefix="wizard-clear-draft"
    />
  );

  return {
    clearDraftPending,
    clearDraftError,
    requestClearDraft,
    clearDraftConfirmDialog,
  };
}
