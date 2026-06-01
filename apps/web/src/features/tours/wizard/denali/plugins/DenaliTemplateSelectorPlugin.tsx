"use client";

import { useTranslations } from "next-intl";

import { useSettingsTourPresets } from "@/hooks/use-settings-tour-presets";
import { DenaliTourCreationPresetBanner } from "@/features/tours/wizard/DenaliTourCreationPresetBanner";

import type { DenaliWizardHeaderPlugin } from "../application/denaliWizardHeaderPlugin";

function DenaliTemplateSelectorPluginView(
  props: Parameters<NonNullable<DenaliWizardHeaderPlugin["render"]>>[0],
) {
  const t = useTranslations("tours.new");
  const presetsQuery = useSettingsTourPresets();

  return (
    <DenaliTourCreationPresetBanner
      presets={presetsQuery.data}
      wizardTemplate={props.wizardTemplate}
      formMethods={props.formMethods}
      ruleSet={props.ruleSet}
      workspaceFormProfile={props.workspaceFormProfile}
      onApplied={() => {
        props.onCanonicalSync();
      }}
      onClear={props.onClearForm}
      onOrchestrationError={props.onOrchestrationError}
      clearLabel={t("wizardPresetClear")}
    />
  );
}

/** In-wizard workspace preset selector (basic step only). */
export const denaliTemplateSelectorPlugin: DenaliWizardHeaderPlugin = {
  id: "denali-template-selector",
  shouldRender: (context) => context.activeStepId === "denali_basic",
  render: (context) => <DenaliTemplateSelectorPluginView {...context} />,
};
