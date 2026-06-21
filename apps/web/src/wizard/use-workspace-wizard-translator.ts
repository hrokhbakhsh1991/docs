"use client";

import { useCallback } from "react";

import { WORKSPACE_WIZARD_I18N_NAMESPACES } from "@/bootstrap/wizard-label-bindings.generated";
import { useGeneratedWorkspaceWizardTranslators } from "@/bootstrap/wizard-i18n-translator-hooks.generated";

type WorkspaceWizardMessageNamespace = (typeof WORKSPACE_WIZARD_I18N_NAMESPACES)[number];

function isWorkspaceWizardMessageNamespace(
  value: string
): value is WorkspaceWizardMessageNamespace {
  return (WORKSPACE_WIZARD_I18N_NAMESPACES as readonly string[]).includes(value);
}

/** Resolve workspace wizard copy from hook-declared namespace (falls back to generic wizard). */
export function useWorkspaceWizardTranslator(wizardMessageNamespace?: string) {
  const translators = useGeneratedWorkspaceWizardTranslators();
  const tWizard = translators.wizard;

  return useCallback(
    (key: string) => {
      const namespace =
        wizardMessageNamespace != null && isWorkspaceWizardMessageNamespace(wizardMessageNamespace)
          ? wizardMessageNamespace
          : "wizard";
      const translate = translators[namespace] ?? tWizard;
      return translate(key);
    },
    [wizardMessageNamespace, translators, tWizard]
  );
}
