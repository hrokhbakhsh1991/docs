"use client";

import { Button } from "@app-tour/ui-primitives/button";
import type { DraftStatus } from "@app-tour/draft-engine";
import { useTranslations } from "next-intl";

import { resolveDraftManualSyncButtonView } from "./draft-manual-sync-button-logic";

export type DraftManualSyncButtonProps = {
  readonly status: DraftStatus;
  readonly navLocked?: boolean;
  readonly clearDraftPending?: boolean;
  readonly onFlush: () => void;
  readonly onRetry: () => void;
  readonly testId?: string;
  readonly className?: string;
};

export function DraftManualSyncButton({
  status,
  navLocked = false,
  clearDraftPending = false,
  onFlush,
  onRetry,
  testId = "wizard-save-draft",
  className,
}: DraftManualSyncButtonProps) {
  const tWizard = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const view = resolveDraftManualSyncButtonView(status);
  const label =
    view.labelNamespace === "common" ? tCommon(view.labelKey) : tWizard(view.labelKey);
  const disabled =
    clearDraftPending || navLocked || view.disabled || status === "SYNCING";

  const onClick = () => {
    if (view.action === "retry") {
      onRetry();
      return;
    }
    if (view.action === "flush") {
      onFlush();
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      data-testid={testId}
      data-draft-sync-action={view.action}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
