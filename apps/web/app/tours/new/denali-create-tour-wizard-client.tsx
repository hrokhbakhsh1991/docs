"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { DenaliCreateTourWizardView } from "@app-tour/workspace-denali/ui/create-wizard";

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
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";

export function DenaliCreateTourWizardClient() {
  const t = useTranslations("wizard");
  const session = useAppSession();
  const wizard = useDenaliCreateTourWizard();

  const formatSubmitError = useCallback(
    (code: string) => {
      if (code === "VALIDATION_FAILED") {
        return t("submit.validationFailed");
      }
      if (code === "DENALI_RULES_NOT_READY") {
        return t("submit.errorGeneric", { status: 0, code });
      }
      if (code.startsWith("ACTION:")) {
        const [, status, actionCode] = code.split(":");
        return t("submit.errorGeneric", {
          status: Number(status),
          code: actionCode ?? "UNKNOWN",
        });
      }
      return t("submit.errorGeneric", { status: 0, code });
    },
    [t]
  );

  return (
    <DenaliCreateTourWizardView
      wizard={wizard}
      authz={session.authz}
      cloneLoadingMessage={t("clone.loading")}
      formatSubmitError={formatSubmitError}
      slots={{
        renderLoading: (props) => <CreateTourWizardLoadingMessage {...props} />,
        renderCloneError: (props) => <CreateTourWizardCloneError {...props} />,
        renderNotConfigured: () => <CreateTourWizardNotConfigured />,
        renderHeader: (props) => <CreateTourWizardDenaliHeader {...props} />,
        renderSeedBanner: (props) => <CreateTourWizardSeedBanner {...props} />,
        renderPresetBanner: (props) => <CreateTourWizardPresetBanner {...props} />,
        renderSubmitFooter: (props) => <CreateTourWizardSubmitFooter {...props} />,
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
