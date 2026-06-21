"use client";

import type { DraftStatus } from "@app-tour/draft-engine";
import { useTranslations } from "next-intl";

export type DraftSyncSoftLockBannerProps = {
  readonly status: DraftStatus;
  readonly className?: string;
};

/** Non-blocking banner when server sync failed or in-flight — fields stay editable (Phase 2/5B). */
export function DraftSyncSoftLockBanner({ status, className }: DraftSyncSoftLockBannerProps) {
  const t = useTranslations("common");

  const messageKey =
    status === "ERROR"
      ? "draftSync.softLockBanner"
      : status === "SYNCING"
        ? "draftSync.syncingSoftLockBanner"
        : status === "CONFLICT_RESOLVING"
          ? "draftSync.conflictSoftLockBanner"
          : null;

  if (messageKey == null) {
    return null;
  }

  return (
    <div
      role="status"
      className={className}
      data-testid="draft-sync-soft-lock-banner"
      data-draft-sync-status={status}
    >
      {t(messageKey)}
    </div>
  );
}
