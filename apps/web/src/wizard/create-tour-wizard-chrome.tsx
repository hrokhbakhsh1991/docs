"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { DraftSchemaIssue, DraftStatus, DraftSyncPayload } from "@app-tour/draft-engine";
import { DraftSyncChrome } from "@/draft/draft-sync-chrome";
import type { NewTourWizardDraftEnvelope } from "@/draft/tour-wizard-draft-envelope";
import type { WizardSubmitErrorPresentation } from "@/wizard/resolve-wizard-submit-error-message";
import { WizardSubmitErrorAlert } from "@/wizard/wizard-submit-error-alert";
import { WorkspaceDraftIndexSummary } from "@/draft/workspace-draft-index-summary";
import type { WorkspaceDraftIndexItem } from "@/draft/workspace-draft-types";
import {
  TOUR_PRESET_PREFILL_TEST_IDS,
} from "@/tours/tour-preset-prefill-logic";
import {
  WIZARD_TEMPLATE_GATE_TEST_IDS,
} from "@/tours/wizard-template-gate-logic";
import {
  WIZARD_TEMPLATE_PREFILL_TEST_IDS,
} from "@/tours/wizard-template-prefill-logic";

export function CreateTourWizardLoadingMessage(props: {
  readonly message?: string;
  readonly testId?: string;
}) {
  const t = useTranslations("wizard");
  return (
    <div data-new-tour-wizard>
      <p
        className="new-tour-wizard-page__loading"
        data-workspace-wizard-loading
        data-testid={props.testId}
      >
        {props.message ?? t("loading")}
      </p>
    </div>
  );
}

export function CreateTourWizardNotConfigured() {
  const t = useTranslations("wizard");
  return (
    <div data-new-tour-wizard>
      <section className="new-tour-wizard-page__empty" data-testid={WIZARD_TEMPLATE_GATE_TEST_IDS.emptyState}>
        <h1 className="new-tour-wizard-page__empty-title">{t("notConfigured.title")}</h1>
        <p className="new-tour-wizard-page__empty-desc">{t("notConfigured.description")}</p>
        <Button asChild data-testid={WIZARD_TEMPLATE_GATE_TEST_IDS.configureLink}>
          <Link href="/settings/tour-wizard-template">{t("notConfigured.configureLink")}</Link>
        </Button>
      </section>
    </div>
  );
}

export function CreateTourWizardCloneError(props: {
  readonly error: string;
  readonly testId?: string;
}) {
  const t = useTranslations("wizard");
  return (
    <div data-new-tour-wizard>
      <p
        className="new-tour-wizard-page__empty-desc"
        role="alert"
        data-testid={props.testId}
      >
        {t("clone.error", { error: props.error })}
      </p>
    </div>
  );
}

export function CreateTourWizardPageHeader(props: {
  readonly actions?: ReactNode;
  readonly belowActions?: ReactNode;
}) {
  const t = useTranslations("wizard");
  return (
    <header className="new-tour-wizard-page__header">
      <div className="new-tour-wizard-page__header-main">
        <div className="new-tour-wizard-page__header-copy">
          <h1 className="new-tour-wizard-page__title">{t("pageTitle")}</h1>
          <p className="new-tour-wizard-page__subtitle">{t("pageSubtitle")}</p>
        </div>
        {props.actions != null ? (
          <div className="new-tour-wizard-page__header-actions">{props.actions}</div>
        ) : null}
      </div>
      {props.belowActions}
    </header>
  );
}

export function CreateTourWizardSeedBanner(props: { readonly seedLabel: string }) {
  const t = useTranslations("wizard");
  return (
    <p
      className="new-tour-wizard-page__seed-banner"
      data-testid={WIZARD_TEMPLATE_PREFILL_TEST_IDS.seedApplied}
      data-seed-label={props.seedLabel}
    >
      {t("seedApplied", { label: props.seedLabel })}
    </p>
  );
}

export function CreateTourWizardPresetBanner(props: { readonly presetId: string }) {
  const t = useTranslations("wizard");
  return (
    <p
      className="new-tour-wizard-page__seed-banner"
      data-testid={TOUR_PRESET_PREFILL_TEST_IDS.applied}
      data-preset-id={props.presetId}
    >
      {t("presetApplied")}
    </p>
  );
}

export function CreateTourWizardSubmitFooter(props: {
  readonly pending: boolean;
  readonly submitError: string | null;
  readonly createdTourId: string | null;
  readonly onSubmit: () => void;
  readonly resolveSubmitError?: (code: string) => WizardSubmitErrorPresentation | null;
}) {
  const t = useTranslations("wizard");
  const submitPresentation =
    props.submitError != null
      ? props.resolveSubmitError?.(props.submitError) ?? { summary: props.submitError }
      : null;
  return (
    <div data-wizard-footer>
      <Button type="button" onClick={props.onSubmit} disabled={props.pending}>
        {props.pending ? t("creating") : t("createButton")}
      </Button>
      <WizardSubmitErrorAlert presentation={submitPresentation} />
      {props.createdTourId ? (
        <p data-tour-created>
          {t("created", { id: props.createdTourId })}
        </p>
      ) : null}
    </div>
  );
}

type OperatorDraftSyncChrome = {
  readonly status: DraftStatus;
  readonly schemaIssues: readonly DraftSchemaIssue[];
  readonly navLocked: boolean;
  readonly pendingDraft: DraftSyncPayload<NewTourWizardDraftEnvelope> | null | undefined;
  readonly conflictReloadNotice: boolean;
  readonly retry: () => Promise<void>;
  readonly flush: () => Promise<void>;
  readonly applyDraft: () => void;
  readonly setData: (
    data: NewTourWizardDraftEnvelope,
    options?: { readonly source?: string }
  ) => void;
  readonly canRevertQuarantine: boolean;
  readonly revertToLastValid: () => void;
};

export function CreateTourWizardHeader(props: {
  readonly currentDraftKey: string;
  readonly draftSync: OperatorDraftSyncChrome;
  readonly draftIndex: {
    readonly loading: boolean;
    readonly items: readonly WorkspaceDraftIndexItem[];
  };
  readonly clearDraftPending: boolean;
  readonly clearDraftError: string | null;
  readonly requestClearDraft: () => void;
  readonly clearDraftConfirmDialog: ReactNode;
}) {
  const t = useTranslations("wizard");
  return (
    <CreateTourWizardPageHeader
      actions={
        <>
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
            clearDraftPending={props.clearDraftPending}
            canRevertQuarantine={props.draftSync.canRevertQuarantine}
            onRevertQuarantine={props.draftSync.revertToLastValid}
            rowClassName="new-tour-wizard-page__header-actions flex flex-wrap items-center gap-2"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="draft-stable-label-button"
            data-testid="wizard-clear-draft"
            disabled={
              props.clearDraftPending ||
              props.draftSync.navLocked ||
              props.draftSync.status === "SYNCING"
            }
            aria-busy={props.clearDraftPending ? true : undefined}
            onClick={props.requestClearDraft}
          >
            <span className="draft-stable-label-button__sizer" aria-hidden>
              <span>{t("clearDraft")}</span>
              <span>{t("clearingDraft")}</span>
            </span>
            <span className="draft-stable-label-button__label">
              {props.clearDraftPending ? t("clearingDraft") : t("clearDraft")}
            </span>
          </Button>
        </>
      }
      belowActions={
        <>
          {props.clearDraftConfirmDialog}
          <WorkspaceDraftIndexSummary
            items={props.draftIndex.items}
            loading={props.draftIndex.loading}
            currentDraftKey={props.currentDraftKey}
          />
          {props.clearDraftError ? (
            <p
              className="new-tour-wizard-page__clear-draft-error"
              role="alert"
              data-testid="wizard-clear-draft-error"
            >
              {props.clearDraftError}
            </p>
          ) : null}
        </>
      }
    />
  );
}
