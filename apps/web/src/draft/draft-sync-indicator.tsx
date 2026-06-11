"use client";

import { Badge } from "@app-tour/ui-primitives/badge";
import type { DraftStatus } from "@app-tour/draft-engine";
import { useTranslations } from "next-intl";

import { resolveDraftSyncIndicatorView } from "./draft-sync-indicator-logic";

export type DraftSyncIndicatorProps = {
  readonly status: DraftStatus;
  readonly onRetry?: () => void;
  readonly className?: string;
};

export function DraftSyncIndicator({ status, onRetry, className }: DraftSyncIndicatorProps) {
  const t = useTranslations("common");
  const view = resolveDraftSyncIndicatorView(status);

  if (!view.visible) {
    return null;
  }

  return (
    <span className={className} data-testid="draft-sync-indicator" data-status={status}>
      <Badge variant={view.variant}>{t(view.messageKey)}</Badge>
      {view.showRetry && onRetry !== undefined ? (
        <button type="button" onClick={() => onRetry()} data-testid="draft-sync-retry">
          {t("draftSync.retry")}
        </button>
      ) : null}
    </span>
  );
}
