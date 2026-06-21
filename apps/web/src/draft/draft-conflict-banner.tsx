"use client";

import { useTranslations } from "next-intl";
import type { DraftSyncPayload } from "@app-tour/draft-engine";

import type { DraftStatus } from "@app-tour/draft-engine";

import { resolveDraftConflictBannerView } from "./draft-conflict-banner-logic";

export type DraftConflictBannerProps<T> = {
  readonly status: DraftStatus;
  readonly pendingDraft?: DraftSyncPayload<T> | null;
  readonly conflictReloadNotice?: boolean;
  readonly onApplyPending?: () => void;
  readonly onDiscardPending?: () => void;
};

export function DraftConflictBanner<T>({
  status,
  pendingDraft,
  conflictReloadNotice = false,
  onApplyPending,
  onDiscardPending,
}: DraftConflictBannerProps<T>) {
  const t = useTranslations("common");
  const view = resolveDraftConflictBannerView(
    status,
    pendingDraft != null,
    onApplyPending !== undefined || onDiscardPending !== undefined,
    conflictReloadNotice,
  );

  if (view.kind === "serverReloaded") {
    return (
      <p className="draft-conflict-banner" data-testid="draft-conflict-server-reloaded" role="status">
        {t("draftSync.serverReloaded")}
      </p>
    );
  }

  if (view.kind === "resolving") {
    return (
      <p className="draft-conflict-banner" data-testid="draft-conflict-resolving" role="status">
        {t("draftSync.conflictResolving")}
      </p>
    );
  }

  if (view.kind === "available") {
    return (
      <div className="draft-conflict-banner" data-testid="draft-conflict-available" role="status">
        <p>{t("draftSync.draftAvailable")}</p>
        {view.showActions && onApplyPending !== undefined ? (
          <button type="button" data-testid="draft-conflict-apply" onClick={() => onApplyPending()}>
            {t("draftSync.applyServer")}
          </button>
        ) : null}
        {view.showActions && onDiscardPending !== undefined ? (
          <button
            type="button"
            data-testid="draft-conflict-discard"
            onClick={() => onDiscardPending()}
          >
            {t("draftSync.discardLocal")}
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
