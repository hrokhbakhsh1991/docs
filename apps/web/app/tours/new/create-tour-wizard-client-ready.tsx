"use client";

import { useTranslations } from "next-intl";
import type React from "react";
import { useCallback } from "react";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { resolveWizardCreateViewSurface } from "@/wizard/wizard-create-view-registry";
import { resolveWizardCatalogPrefetchProvider } from "@/wizard/wizard-host-adapter-registry";
import { useAppSession } from "@/providers/app-session-context";
import {
  CreateTourWizardCloneError,
  CreateTourWizardClonePhotoRemintWarning,
  CreateTourWizardHeader,
  CreateTourWizardLoadingMessage,
  CreateTourWizardNotConfigured,
  CreateTourWizardPresetBanner,
  CreateTourWizardSeedBanner,
  CreateTourWizardSubmitFooter,
} from "@/wizard/create-tour-wizard-chrome";
import { createWizardSubmitErrorTranslator } from "@/wizard/create-wizard-submit-error-translator";
import { platformCreateTourDraftKey } from "@/wizard/platform-wizard-draft-binding";
import {
  createWizardSubmitFieldLabelResolver,
  resolveWizardSubmitErrorMessage,
} from "@/wizard/resolve-wizard-submit-error-message";
import { useOperatorCreateTourWizard } from "@/wizard/use-create-tour-wizard";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";

export type OperatorCreateTourWizardClientReadyProps = {
  readonly plugin: WorkspacePlugin;
  readonly initialTemplateResponse?: unknown | null;
};

/** Ready mount after `warmOperatorWizardShell` — slots + resolved create view. */
export function OperatorCreateTourWizardClientReady({
  plugin,
  initialTemplateResponse = null,
}: OperatorCreateTourWizardClientReadyProps) {
  const t = useTranslations("wizard");
  const session = useAppSession();
  const tWizard = useWorkspaceWizardTranslator(session.pluginId);
  const wizard = useOperatorCreateTourWizard({ plugin, initialTemplateResponse });

  const resolveSubmitError = useCallback(
    (code: string) =>
      resolveWizardSubmitErrorMessage({
        pluginId: session.pluginId,
        raw: code,
        context: "create",
        translateFieldLabel: createWizardSubmitFieldLabelResolver(session.pluginId, (key) =>
          tWizard(key)
        ),
        t: createWizardSubmitErrorTranslator(t),
      }),
    [t, tWizard, session.pluginId]
  );

  const viewSurface = resolveWizardCreateViewSurface(plugin.id);
  if (viewSurface == null) {
    return <CreateTourWizardLoadingMessage />;
  }
  const CreateTourWizardView = viewSurface.CreateTourWizardView;

  return (
    <CreateTourWizardView
      wizard={wizard}
      authz={session.authz}
      cloneLoadingMessage={t("clone.loading")}
      resolveSubmitError={resolveSubmitError}
      slots={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderLoading: (props: any) => <CreateTourWizardLoadingMessage {...props} />,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderCloneError: (props: any) => <CreateTourWizardCloneError {...props} />,
        renderNotConfigured: () => <CreateTourWizardNotConfigured />,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderHeader: (props: any) => (
          <CreateTourWizardHeader
            currentDraftKey={platformCreateTourDraftKey(session.pluginId)}
            draftSync={
              props.draftSync as unknown as React.ComponentProps<
                typeof CreateTourWizardHeader
              >["draftSync"]
            }
            draftIndex={
              props.draftIndex as React.ComponentProps<typeof CreateTourWizardHeader>["draftIndex"]
            }
            clearDraftPending={props.clearDraftPending}
            clearDraftError={props.clearDraftError}
            requestClearDraft={props.requestClearDraft}
            clearDraftConfirmDialog={props.clearDraftConfirmDialog}
          />
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderSeedBanner: (props: any) => <CreateTourWizardSeedBanner {...props} />,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderClonePhotoRemintWarning: (props: any) => (
          <CreateTourWizardClonePhotoRemintWarning {...props} />
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderPresetBanner: (props: any) => <CreateTourWizardPresetBanner {...props} />,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderSubmitFooter: (props: any) => (
          <CreateTourWizardSubmitFooter
            pending={props.pending}
            submitError={props.submitError}
            createdTourId={props.createdTourId}
            onSubmit={props.onSubmit}
            resolveSubmitError={props.resolveSubmitError}
          />
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderWizardHost: (hostProps: any) => (
          <WorkspaceWizardHost
            pluginId={hostProps.pluginId}
            tenantId={hostProps.tenantId}
            workspaceId={hostProps.workspaceId}
            authz={hostProps.authz as Parameters<typeof WorkspaceWizardHost>[0]["authz"]}
            draft={hostProps.draft}
            onDraftChange={hostProps.onDraftChange}
            allowedCanonicalPaths={hostProps.allowedCanonicalPaths}
            templateSteps={hostProps.templateSteps}
            wizardSessionId={hostProps.wizardSessionId}
            activeStepIndex={hostProps.activeStepIndex}
            onActiveStepIndexChange={hostProps.onActiveStepIndexChange}
            navLocked={hostProps.navLocked}
            draftSyncStatus={hostProps.draftSyncStatus}
            submitValidationIssues={hostProps.submitValidationIssues}
            onSubmitValidationHandled={hostProps.onSubmitValidationHandled}
            wizardRuleEvalContext={hostProps.wizardRuleEvalContext}
            draftHydrated={hostProps.draftHydrated}
            draftResumeEpoch={hostProps.draftResumeEpoch}
            suppressDraftStepInference={hostProps.suppressDraftStepInference}
            renderFooter={hostProps.renderFooter}
          />
        ),
      }}
    />
  );
}

/** Prefetch wrapper kept with Ready so the loader file stays under P15-W-B1e.
 * Thin Shell Phase 2b/2c / 4r — warm via ensureWizardHostReady (capabilities → legacy).
 */
export function OperatorCreateTourWizardCatalogShell({
  initialLocationsResponse,
  children,
}: {
  readonly initialLocationsResponse?: unknown | null;
  readonly children: React.ReactNode;
}) {
  const session = useAppSession();

  const Provider = resolveWizardCatalogPrefetchProvider(session.pluginId);
  if (Provider == null) {
    return <>{children}</>;
  }
  return <Provider initialLocationsResponse={initialLocationsResponse}>{children}</Provider>;
}
