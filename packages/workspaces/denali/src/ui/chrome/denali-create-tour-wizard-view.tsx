"use client";

import type { ValidationIssue } from "@app-tour/wizard-navigation";
import type { ReactNode } from "react";

import type { DenaliCreateTourWizardCoreState } from "./use-create-tour-wizard-core";

export type DenaliCreateTourWizardHostRenderProps = {
  readonly pluginId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly authz: unknown;
  readonly draft: DenaliCreateTourWizardCoreState["draft"];
  readonly onDraftChange: DenaliCreateTourWizardCoreState["onDraftChange"];
  readonly allowedCanonicalPaths: readonly string[];
  readonly templateSteps: DenaliCreateTourWizardCoreState["gate"]["templateSteps"];
  readonly wizardSessionId: string;
  readonly activeStepIndex: number;
  readonly onActiveStepIndexChange: DenaliCreateTourWizardCoreState["onActiveStepIndexChange"];
  readonly navLocked: boolean;
  readonly draftSyncStatus: DenaliCreateTourWizardCoreState["draftSync"]["status"];
  readonly submitValidationIssues: readonly ValidationIssue[] | null;
  readonly onSubmitValidationHandled: () => void;
  readonly wizardRuleEvalContext: DenaliCreateTourWizardCoreState["wizardRuleEvalContext"];
  readonly draftHydrated: boolean;
  readonly draftResumeEpoch: number;
  readonly suppressDraftStepInference: boolean;
  readonly renderFooter: () => ReactNode;
};

export type DenaliWizardSubmitErrorPresentation = {
  readonly summary: string;
  readonly details?: readonly string[];
};

export type DenaliCreateTourWizardViewSlots = {
  readonly renderLoading: (props: { readonly message?: string; readonly testId?: string }) => ReactNode;
  readonly renderCloneError: (props: {
    readonly error: string;
    readonly testId?: string;
  }) => ReactNode;
  readonly renderNotConfigured: () => ReactNode;
  readonly renderHeader: (props: {
    readonly draftSync: DenaliCreateTourWizardCoreState["draftSync"];
    readonly draftIndex: DenaliCreateTourWizardCoreState["draftIndex"];
    readonly clearDraftPending: boolean;
    readonly clearDraftError: DenaliCreateTourWizardCoreState["clearDraft"]["clearDraftError"];
    readonly requestClearDraft: DenaliCreateTourWizardCoreState["clearDraft"]["requestClearDraft"];
    readonly clearDraftConfirmDialog: DenaliCreateTourWizardCoreState["clearDraft"]["clearDraftConfirmDialog"];
  }) => ReactNode;
  readonly renderSeedBanner: (props: { readonly seedLabel: string }) => ReactNode;
  readonly renderClonePhotoRemintWarning: (props: { readonly testId: string }) => ReactNode;
  readonly renderPresetBanner: (props: { readonly presetId: string }) => ReactNode;
  readonly renderSubmitFooter: (props: {
    readonly pending: boolean;
    readonly submitError: string | null;
    readonly createdTourId: string | null;
    readonly onSubmit: () => void;
    readonly resolveSubmitError: (code: string) => DenaliWizardSubmitErrorPresentation | null;
  }) => ReactNode;
  readonly renderWizardHost: (props: DenaliCreateTourWizardHostRenderProps) => ReactNode;
};

export type DenaliCreateTourWizardViewProps = {
  readonly wizard: DenaliCreateTourWizardCoreState;
  readonly authz: unknown;
  readonly cloneLoadingMessage: string;
  readonly resolveSubmitError: (code: string) => DenaliWizardSubmitErrorPresentation | null;
  readonly slots: DenaliCreateTourWizardViewSlots;
};

/** Phase 14 PR-5c — Denali create wizard screen tree (shell injects platform chrome + host). */
export function DenaliCreateTourWizardView({
  wizard,
  authz,
  cloneLoadingMessage,
  resolveSubmitError,
  slots,
}: DenaliCreateTourWizardViewProps) {
  if (wizard.screen === "gate-loading" || wizard.screen === "clone-loading") {
    return slots.renderLoading({
      message: wizard.screen === "clone-loading" ? cloneLoadingMessage : undefined,
      testId: wizard.screen === "clone-loading" ? wizard.cloneLoadingTestId : undefined,
    });
  }

  if (wizard.screen === "clone-error") {
    return slots.renderCloneError({
      error: wizard.cloneError ?? "TOUR_CLONE_FAILED",
      testId: wizard.cloneErrorTestId,
    });
  }

  if (wizard.screen === "not-configured") {
    return slots.renderNotConfigured();
  }

  if (wizard.screen === "draft-loading") {
    return slots.renderLoading({ testId: "wizard-draft-hydrate-loading" });
  }

  return (
    <div className="new-tour-wizard-page" data-new-tour-wizard>
      {slots.renderHeader({
        draftSync: wizard.draftSync,
        draftIndex: wizard.draftIndex,
        clearDraftPending: wizard.clearDraft.clearDraftPending,
        clearDraftError: wizard.clearDraft.clearDraftError,
        requestClearDraft: wizard.clearDraft.requestClearDraft,
        clearDraftConfirmDialog: wizard.clearDraft.clearDraftConfirmDialog,
      })}
      {wizard.showSeedBanner ? (
        slots.renderSeedBanner({ seedLabel: wizard.gate.seedLabel })
      ) : null}
      {wizard.clonePhotoRemintWarning ? (
        slots.renderClonePhotoRemintWarning({
          testId: wizard.clonePhotoRemintWarningTestId,
        })
      ) : null}
      {wizard.presetApplied && wizard.presetId ? (
        slots.renderPresetBanner({ presetId: wizard.presetId })
      ) : null}
      {slots.renderWizardHost({
        pluginId: wizard.session.pluginId,
        tenantId: wizard.session.tenantId,
        workspaceId: wizard.session.workspaceId,
        authz,
        draft: wizard.draft,
        onDraftChange: wizard.onDraftChange,
        allowedCanonicalPaths: wizard.gate.allowedCanonicalPaths,
        templateSteps: wizard.gate.templateSteps,
        wizardSessionId: wizard.wizardSessionId,
        activeStepIndex: wizard.activeStepIndex,
        onActiveStepIndexChange: wizard.onActiveStepIndexChange,
        navLocked: wizard.draftSync.navLocked || wizard.clearDraft.clearDraftPending,
        draftSyncStatus: wizard.draftSync.status,
        submitValidationIssues: wizard.submitValidationIssues,
        onSubmitValidationHandled: () => wizard.setSubmitValidationIssues(null),
        wizardRuleEvalContext: wizard.wizardRuleEvalContext,
        draftHydrated: wizard.denaliDraftHydrated,
        draftResumeEpoch: wizard.draftResumeEpoch,
        suppressDraftStepInference: wizard.suppressDraftStepInference,
        renderFooter: () =>
          slots.renderSubmitFooter({
            pending: wizard.pending,
            submitError: wizard.submitError,
            createdTourId: wizard.createdTourId,
            onSubmit: wizard.onSubmit,
            resolveSubmitError,
          }),
      })}
    </div>
  );
}
