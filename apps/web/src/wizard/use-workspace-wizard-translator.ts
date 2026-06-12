"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

/** Known workspace wizard message namespaces wired in the web host. */
const WORKSPACE_WIZARD_MESSAGE_NAMESPACES = ["wizard", "denali"] as const;

type WorkspaceWizardMessageNamespace = (typeof WORKSPACE_WIZARD_MESSAGE_NAMESPACES)[number];

function isWorkspaceWizardMessageNamespace(value: string): value is WorkspaceWizardMessageNamespace {
  return (WORKSPACE_WIZARD_MESSAGE_NAMESPACES as readonly string[]).includes(value);
}

/** Resolve workspace wizard copy from hook-declared namespace (falls back to generic wizard). */
export function useWorkspaceWizardTranslator(wizardMessageNamespace?: string) {
  const tWizard = useTranslations("wizard");
  const tDenali = useTranslations("denali");

  const translators = useMemo(
    () =>
      ({
        wizard: tWizard,
        denali: tDenali,
      }) as const satisfies Record<WorkspaceWizardMessageNamespace, typeof tWizard>,
    [tWizard, tDenali]
  );

  return useCallback(
    (key: string) => {
      const namespace =
        wizardMessageNamespace != null && isWorkspaceWizardMessageNamespace(wizardMessageNamespace)
          ? wizardMessageNamespace
          : "wizard";
      return translators[namespace](key);
    },
    [wizardMessageNamespace, translators]
  );
}
