"use client";

import { denaliTemplateOrchestratorFactory, type OrchestrationOutput } from "@repo/denali-domain";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";

import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";
import {
  DenaliSection,
  type DenaliEditSectionId,
} from "@/features/tours/denali/fields/DenaliSection";
import { DENALI_QUIET_FORM_RESET_OPTIONS } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import {
  DENALI_TEMPLATE_SETTINGS_HOST_CAPABILITIES,
  DenaliFormHostProvider,
} from "@/features/tours/wizard/denali/DenaliFormHostContext";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliCore.schema";
import { useAppToast } from "@/lib/use-app-toast";

import styles from "./tour-wizard-template.module.css";

const PREVIEW_SECTIONS: readonly DenaliEditSectionId[] = getDenaliWizardSteps().filter(
  (step): step is DenaliEditSectionId => step !== "review",
);

export type TourWizardTemplatePreviewPanelProps = {
  previewTemplate: TenantWizardTemplate;
  canonicalData: Readonly<Record<string, unknown>>;
  /** Filled on mount so the builder can read preview edits on Save. */
  previewFormRef?: MutableRefObject<UseFormReturn<DenaliCreateTourWizardForm> | null>;
};

type PreviewOrchestrationState =
  | { status: "idle" }
  | { status: "empty" }
  | { status: "success" }
  | {
      status: "failed";
      errors: readonly string[];
      failureKind?: OrchestrationOutput["failureKind"];
    };

function formatOrchestrationErrors(result: OrchestrationOutput): string[] {
  if (result.validationIssues != null && result.validationIssues.length > 0) {
    return result.validationIssues.map((issue) =>
      issue.path ? `${issue.path}: ${issue.message}` : issue.message,
    );
  }
  if (result.errors != null && result.errors.length > 0) {
    return [...result.errors];
  }
  return ["Template orchestration failed."];
}

export function TourWizardTemplatePreviewPanel({
  previewTemplate,
  canonicalData,
  previewFormRef,
}: TourWizardTemplatePreviewPanelProps) {
  const t = useTranslations("settings");
  const toast = useAppToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const previewDefaults = useMemo(() => buildDenaliTourCreateDefaultValues(), []);
  const workspaceFormProfile = useMemo(
    () => resolveWorkspaceTourFormProfileFromTemplate(previewTemplate),
    [previewTemplate],
  );

  const previewForm = useForm<DenaliCreateTourWizardForm>({
    defaultValues: previewDefaults,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (previewFormRef) {
      previewFormRef.current = previewForm;
    }
    return () => {
      if (previewFormRef) {
        previewFormRef.current = null;
      }
    };
  }, [previewForm, previewFormRef]);

  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const [orchestrationState, setOrchestrationState] = useState<PreviewOrchestrationState>({
    status: "idle",
  });
  const lastGoodFormRef = useRef<DenaliCreateTourWizardForm | null>(null);
  const lastToastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydratePreviewFromFactory() {
      if (Object.keys(canonicalData).length === 0) {
        previewForm.reset(previewDefaults, DENALI_QUIET_FORM_RESET_OPTIONS);
        lastGoodFormRef.current = previewDefaults;
        lastToastSignatureRef.current = null;
        if (!cancelled) {
          setOrchestrationState({ status: "empty" });
          setCanonicalSyncToken((token) => token + 1);
        }
        return;
      }

      try {
        const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate(
          {
            workspaceId: previewTemplate.workspaceId,
            templateId: previewTemplate.id,
            canonicalData: { ...canonicalData },
            fieldRulesOverlay: previewTemplate.fieldRulesOverlay,
          },
          { defaultValues: previewDefaults },
        );

        if (cancelled) {
          return;
        }

        const draftForm = result.draftState.data.form;
        if (result.success && draftForm != null && typeof draftForm === "object") {
          const form = draftForm as DenaliCreateTourWizardForm;
          previewForm.reset(form, DENALI_QUIET_FORM_RESET_OPTIONS);
          lastGoodFormRef.current = form;
          lastToastSignatureRef.current = null;
          setOrchestrationState({ status: "success" });
          setCanonicalSyncToken((token) => token + 1);
          return;
        }

        const errors = formatOrchestrationErrors(result);
        const failureKind = result.failureKind;
        setOrchestrationState({ status: "failed", errors, failureKind });

        const toastSignature = JSON.stringify({ errors, failureKind });
        if (lastToastSignatureRef.current !== toastSignature) {
          lastToastSignatureRef.current = toastSignature;
          toastRef.current.error({
            title: t("tourWizardTemplatePreviewOrchestrationFailedTitle"),
            message: errors.join(" · "),
          });
        }

        if (lastGoodFormRef.current != null) {
          previewForm.reset(lastGoodFormRef.current, DENALI_QUIET_FORM_RESET_OPTIONS);
        }
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        const errors = [message];
        setOrchestrationState({ status: "failed", errors });

        const toastSignature = JSON.stringify({ errors });
        if (lastToastSignatureRef.current !== toastSignature) {
          lastToastSignatureRef.current = toastSignature;
          toastRef.current.error({
            title: t("tourWizardTemplatePreviewOrchestrationFailedTitle"),
            message,
          });
        }

        if (lastGoodFormRef.current != null) {
          previewForm.reset(lastGoodFormRef.current, DENALI_QUIET_FORM_RESET_OPTIONS);
        }
      }
    }

    void hydratePreviewFromFactory();

    return () => {
      cancelled = true;
    };
  }, [canonicalData, previewDefaults, previewForm, previewTemplate, t]);

  const previewBlocked = orchestrationState.status === "failed";

  return (
    <aside className={styles.previewPanel} data-testid="tour-wizard-template-preview-panel">
      <h2 className={styles.previewTitle}>{t("tourWizardTemplatePreviewTitle")}</h2>
      <p className={styles.previewHint}>{t("tourWizardTemplatePreviewHint")}</p>

      {orchestrationState.status === "empty" ? (
        <p
          className={styles.previewEmptyHint}
          data-testid="tour-wizard-template-preview-empty-state"
        >
          {t("tourWizardTemplatePreviewEmptyTemplateHint")}
        </p>
      ) : null}

      {previewBlocked ? (
        <div
          className={styles.previewOrchestrationFailed}
          role="alert"
          data-testid="tour-wizard-template-preview-orchestration-failed"
        >
          <p className={styles.previewOrchestrationFailedTitle}>
            {t("tourWizardTemplatePreviewOrchestrationFailedTitle")}
          </p>
          <p className={styles.previewOrchestrationFailedHint}>
            {t("tourWizardTemplatePreviewOrchestrationFailedHint")}
          </p>
          {orchestrationState.failureKind ? (
            <p className={styles.previewOrchestrationFailedKind}>
              {t("tourWizardTemplatePreviewOrchestrationFailedKind", {
                kind: orchestrationState.failureKind,
              })}
            </p>
          ) : null}
          <ul className={styles.previewOrchestrationFailedList}>
            {orchestrationState.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={styles.previewScroll}
        hidden={previewBlocked}
        aria-hidden={previewBlocked}
      >
        <QuickAddModalProvider>
          <FormProvider {...previewForm}>
            <DenaliFormHostProvider
              mode="template-settings"
              capabilities={DENALI_TEMPLATE_SETTINGS_HOST_CAPABILITIES}
            >
              <DenaliCanonicalProvider
                formMethods={previewForm}
                syncToken={canonicalSyncToken}
                wizardTemplate={previewTemplate}
                workspaceFormProfile={workspaceFormProfile}
                draftStatus="IDLE"
              >
                {PREVIEW_SECTIONS.map((sectionId) => (
                  <DenaliSection key={sectionId} sectionId={sectionId} />
                ))}
              </DenaliCanonicalProvider>
            </DenaliFormHostProvider>
          </FormProvider>
        </QuickAddModalProvider>
      </div>
    </aside>
  );
}
