"use client";

import type { DraftStatus } from "@app-tour/draft-engine";
import { useTranslations } from "next-intl";

export type DraftSyncSoftLockBannerProps = {
  readonly status: DraftStatus;
  readonly className?: string;
};

/** Non-blocking banner when server sync failed — fields stay editable (Phase 2). */
export function DraftSyncSoftLockBanner({ status, className }: DraftSyncSoftLockBannerProps) {
  const t = useTranslations("common");

  if (status !== "ERROR") {
    return null;
  }

  return (
    <div
      role="status"
      className={className}
      data-testid="draft-sync-soft-lock-banner"
      data-draft-sync-status={status}
    >
      {t("draftSync.softLockBanner")}
    </div>
  );
}
