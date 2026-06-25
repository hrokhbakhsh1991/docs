"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DraftSyncChrome } from "@/draft/draft-sync-chrome";
import type { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import { TOUR_EDIT_TEST_IDS } from "@/features/tours/operator-tour-detail-types";

type DenaliFlatEditDraftSync = Pick<
  ReturnType<typeof useWorkspaceDraft<unknown>>,
  | "status"
  | "schemaIssues"
  | "navLocked"
  | "pendingDraft"
  | "conflictReloadNotice"
  | "retry"
  | "flush"
  | "applyDraft"
  | "setData"
  | "canRevertQuarantine"
  | "revertToLastValid"
>;

export function DenaliFlatEditPageShell(props: {
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      className="new-tour-wizard-page space-y-6"
      data-new-tour-wizard
      data-denali-flat-edit-page
      data-testid={props.testId}
    >
      {props.children}
    </div>
  );
}

export function DenaliFlatEditPageHeader(props: {
  readonly tourId: string;
  readonly title: string;
  readonly statusBadge: ReactNode;
  readonly metaLine: string | null;
  readonly toursNavLabel: string;
  readonly workspaceNavLabel: string;
  readonly draftSync: DenaliFlatEditDraftSync;
}) {
  return (
    <>
      <nav className="new-tour-wizard-page__flat-edit-nav">
        <Link href="/tours">
          <Button type="button" variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {props.toursNavLabel}
          </Button>
        </Link>
        <Link href={`/tours/${encodeURIComponent(props.tourId)}/workspace`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid={TOUR_EDIT_TEST_IDS.workspace}
          >
            {props.workspaceNavLabel}
          </Button>
        </Link>
      </nav>

      <header className="new-tour-wizard-page__header">
        <div className="new-tour-wizard-page__header-main">
          <div className="new-tour-wizard-page__header-copy">
            {props.statusBadge}
            <h1 className="new-tour-wizard-page__title">{props.title}</h1>
            {props.metaLine != null && props.metaLine.length > 0 ? (
              <p className="new-tour-wizard-page__subtitle">{props.metaLine}</p>
            ) : null}
          </div>
          <div className="new-tour-wizard-page__header-actions">
            <DraftSyncChrome
              status={props.draftSync.status}
              schemaIssues={props.draftSync.schemaIssues}
              navLocked={props.draftSync.navLocked}
              pendingDraft={props.draftSync.pendingDraft}
              conflictReloadNotice={props.draftSync.conflictReloadNotice}
              onRetry={() => void props.draftSync.retry()}
              onFlush={() => void props.draftSync.flush()}
              onApplyPending={props.draftSync.applyDraft}
              onDiscardPending={() => {
                if (props.draftSync.pendingDraft != null) {
                  props.draftSync.setData(props.draftSync.pendingDraft.data, { source: "remote" });
                }
              }}
              manualSyncTestId={TOUR_EDIT_TEST_IDS.save}
              rowTestId={TOUR_EDIT_TEST_IDS.draftSync}
              showInlineSoftLockBanner
              canRevertQuarantine={props.draftSync.canRevertQuarantine}
              onRevertQuarantine={props.draftSync.revertToLastValid}
              rowClassName="new-tour-wizard-page__header-actions flex flex-wrap items-center gap-2"
            />
          </div>
        </div>
      </header>
    </>
  );
}
