"use client";

import type { DraftEngineState, DraftStatus } from "@app-tour/draft-engine";

import { DraftConflictBanner } from "./draft-conflict-banner";
import { DraftManualSyncButton } from "./draft-manual-sync-button";
import { DraftQuarantineBanner } from "./draft-quarantine-banner";
import { DraftSyncIndicator } from "./draft-sync-indicator";
import { DraftSyncSoftLockBanner } from "./draft-sync-soft-lock-banner";

export type DraftSyncChromeProps<T> = {
  readonly status: DraftStatus;
  readonly schemaIssues?: DraftEngineState<T>["schemaIssues"];
  readonly navLocked?: boolean;
  readonly pendingDraft?: DraftEngineState<T>["pendingDraft"];
  readonly onRetry: () => void;
  readonly onFlush: () => void;
  readonly canRevertQuarantine?: boolean;
  readonly onRevertQuarantine?: () => void;
  readonly onApplyPending?: () => void;
  readonly onDiscardPending?: () => void;
  readonly clearDraftPending?: boolean;
  readonly manualSyncTestId?: string;
  readonly indicatorClassName?: string;
  readonly rowClassName?: string;
  readonly stackClassName?: string;
  /** Inline soft-lock for flat-edit; create-tour keeps wizard-host banner for step body. */
  readonly showInlineSoftLockBanner?: boolean;
  readonly softLockClassName?: string;
  readonly rowTestId?: string;
};

export function DraftSyncChrome<T>({
  status,
  schemaIssues,
  navLocked = false,
  pendingDraft,
  onRetry,
  onFlush,
  canRevertQuarantine = false,
  onRevertQuarantine,
  onApplyPending,
  onDiscardPending,
  clearDraftPending = false,
  manualSyncTestId = "wizard-save-draft",
  indicatorClassName,
  rowClassName = "flex flex-wrap items-center gap-2",
  stackClassName = "space-y-2",
  showInlineSoftLockBanner = false,
  softLockClassName,
  rowTestId,
}: DraftSyncChromeProps<T>) {
  return (
    <div data-draft-sync-chrome className="draft-sync-chrome">
      <div className={rowClassName} data-testid={rowTestId}>
        <DraftSyncIndicator
          className={indicatorClassName}
          status={status}
          onRetry={onRetry}
        />
        <DraftManualSyncButton
          status={status}
          navLocked={navLocked}
          clearDraftPending={clearDraftPending}
          onFlush={onFlush}
          onRetry={onRetry}
          testId={manualSyncTestId}
        />
      </div>
      <div className={stackClassName}>
        {onApplyPending != null && onDiscardPending != null ? (
          <DraftConflictBanner
            status={status}
            pendingDraft={pendingDraft}
            onApplyPending={onApplyPending}
            onDiscardPending={onDiscardPending}
          />
        ) : null}
        <DraftQuarantineBanner
          status={status}
          schemaIssues={schemaIssues}
          canRevert={canRevertQuarantine}
          onRevert={onRevertQuarantine}
        />
        {showInlineSoftLockBanner ? (
          <DraftSyncSoftLockBanner status={status} className={softLockClassName} />
        ) : null}
      </div>
    </div>
  );
}
