"use client";

import { useTranslations } from "next-intl";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";
import {
  DenaliSection,
  type DenaliEditSectionId,
} from "@/features/tours/denali/fields/DenaliSection";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import {
  DENALI_TEMPLATE_SETTINGS_HOST_CAPABILITIES,
  DenaliFormHostProvider,
} from "@/features/tours/wizard/denali/DenaliFormHostContext";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { isDenaliCanonicalTemplateDataEmpty } from "@repo/types/denali";

import styles from "./tour-wizard-template.module.css";

const PREVIEW_SECTIONS: readonly DenaliEditSectionId[] = getDenaliWizardSteps().filter(
  (step): step is DenaliEditSectionId => step !== "review",
);

export type TourWizardTemplatePreviewPanelProps = {
  previewTemplate: TenantWizardTemplate;
  /** Shared hydrated wizard form (parent orchestrates on saved template row change). */
  formMethods: UseFormReturn<DenaliCreateTourWizardForm>;
  canonicalSyncToken: number;
  wizardHydrated: boolean;
  hydrationError?: readonly string[] | null;
};

export function TourWizardTemplatePreviewPanel({
  previewTemplate,
  formMethods,
  canonicalSyncToken,
  wizardHydrated,
  hydrationError,
}: TourWizardTemplatePreviewPanelProps) {
  const t = useTranslations("settings");
  const workspaceFormProfile = resolveWorkspaceTourFormProfileFromTemplate(previewTemplate);
  const isTemplateCanonicalEmpty = isDenaliCanonicalTemplateDataEmpty(previewTemplate.canonicalData);
  const previewBlocked = hydrationError != null && hydrationError.length > 0;

  return (
    <aside className={styles.previewPanel} data-testid="tour-wizard-template-preview-panel">
      <h2 className={styles.previewTitle}>{t("tourWizardTemplatePreviewTitle")}</h2>
      <p className={styles.previewHint}>{t("tourWizardTemplatePreviewHint")}</p>

      {isTemplateCanonicalEmpty && wizardHydrated ? (
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
          <ul className={styles.previewOrchestrationFailedList}>
            {hydrationError?.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={styles.previewScroll}
        hidden={previewBlocked || !wizardHydrated}
        aria-hidden={previewBlocked || !wizardHydrated}
      >
        <QuickAddModalProvider>
          <FormProvider {...formMethods}>
            <DenaliFormHostProvider
              mode="template-settings"
              capabilities={DENALI_TEMPLATE_SETTINGS_HOST_CAPABILITIES}
            >
              <DenaliCanonicalProvider
                formMethods={formMethods}
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
