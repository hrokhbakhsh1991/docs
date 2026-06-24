"use client";

import { Badge } from "@app-tour/ui-primitives/badge";
import type { DraftStatus } from "@app-tour/draft-engine";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { resolveDraftSyncIndicatorView } from "./draft-sync-indicator-logic";

export type DraftSyncIndicatorProps = {
  readonly status: DraftStatus;
  readonly onRetry?: () => void;
  readonly className?: string;
};

/** Widest routine badge copy — reserves inline size when the indicator is hidden (IDLE). */
const SYNC_INDICATOR_RESERVE_KEYS = ["draftSync.dirty", "draftSync.syncing"] as const;

export function DraftSyncIndicator({ status, onRetry, className }: DraftSyncIndicatorProps) {
  const t = useTranslations("common");
  const view = resolveDraftSyncIndicatorView(status);

  return (
    <span
      className={cn("draft-sync-indicator", className)}
      data-testid="draft-sync-indicator"
      data-status={status}
      data-visible={view.visible}
      aria-hidden={view.visible ? undefined : true}
    >
      <span className="draft-sync-indicator__sizer" aria-hidden>
        {SYNC_INDICATOR_RESERVE_KEYS.map((messageKey) => (
          <Badge key={messageKey} variant="warning">
            {t(messageKey)}
          </Badge>
        ))}
      </span>
      {view.visible ? (
        <span className="draft-sync-indicator__surface">
          <Badge variant={view.variant}>{t(view.messageKey)}</Badge>
          {view.showRetry && onRetry !== undefined ? (
            <button type="button" onClick={() => onRetry()} data-testid="draft-sync-retry">
              {t("draftSync.retry")}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
