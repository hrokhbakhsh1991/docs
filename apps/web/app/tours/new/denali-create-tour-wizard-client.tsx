"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { DenaliCreateTourWizardView } from "@app-tour/workspace-denali/ui/create-wizard";

import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { createWizardSubmitErrorTranslator } from "@/wizard/create-wizard-submit-error-translator";
import {
  createDenaliWizardSubmitFieldLabelResolver,
  resolveWizardSubmitErrorMessage,
} from "@/wizard/resolve-wizard-submit-error-message";
import { useAppSession } from "@/providers/app-session-context";
import {
  CreateTourWizardCloneError,
  CreateTourWizardDenaliHeader,
  CreateTourWizardLoadingMessage,
  CreateTourWizardNotConfigured,
  CreateTourWizardPresetBanner,
  CreateTourWizardSeedBanner,
  CreateTourWizardSubmitFooter,
} from "@/wizard/create-tour-wizard-chrome";
import { useDenaliCreateTourWizard } from "@/wizard/use-denali-create-tour-wizard";
import { DenaliWizardCatalogPrefetchProvider } from "@/wizard/denali/denali-wizard-catalog-prefetch-context";
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";

type DenaliCreateTourWizardClientProps = {
  readonly initialTemplateResponse?: unknown | null;
  readonly initialLocationsResponse?: unknown | null;
};

function DenaliCreateTourWizardClientInner({
  initialTemplateResponse = null,
}: Pick<DenaliCreateTourWizardClientProps, "initialTemplateResponse">) {
  const t = useTranslations("wizard");
  const tDenali = useWorkspaceWizardTranslator("denali");
  const session = useAppSession();
  const wizard = useDenaliCreateTourWizard({ initialTemplateResponse });

  const resolveSubmitError = useCallback(
    (code: string) =>
      resolveWizardSubmitErrorMessage({
        raw: code,
        context: "create",
        translateFieldLabel: createDenaliWizardSubmitFieldLabelResolver((key) => tDenali(key)),
        t: createWizardSubmitErrorTranslator(t),
      }),
    [t, tDenali]
  );

  return (
    <DenaliCreateTourWizardView
      wizard={wizard}
      authz={session.authz}
      cloneLoadingMessage={t("clone.loading")}
      resolveSubmitError={resolveSubmitError}
      slots={{
        renderLoading: (props) => <CreateTourWizardLoadingMessage {...props} />,
        renderCloneError: (props) => <CreateTourWizardCloneError {...props} />,
        renderNotConfigured: () => <CreateTourWizardNotConfigured />,
        renderHeader: (props) => <CreateTourWizardDenaliHeader {...props} />,
        renderSeedBanner: (props) => <CreateTourWizardSeedBanner {...props} />,
        renderPresetBanner: (props) => <CreateTourWizardPresetBanner {...props} />,
        renderSubmitFooter: (props) => (
          <CreateTourWizardSubmitFooter
            pending={props.pending}
            submitError={props.submitError}
            createdTourId={props.createdTourId}
            onSubmit={props.onSubmit}
            resolveSubmitError={props.resolveSubmitError}
          />
        ),
        renderWizardHost: (hostProps) => (
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

export function DenaliCreateTourWizardClient({
  initialTemplateResponse = null,
  initialLocationsResponse = null,
}: DenaliCreateTourWizardClientProps) {
  return (
    <DenaliWizardCatalogPrefetchProvider initialLocationsResponse={initialLocationsResponse}>
      <DenaliCreateTourWizardClientInner initialTemplateResponse={initialTemplateResponse} />
    </DenaliWizardCatalogPrefetchProvider>
  );
}
