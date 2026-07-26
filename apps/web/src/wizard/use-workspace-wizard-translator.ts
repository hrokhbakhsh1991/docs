"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { isWorkspaceWizardI18nNamespace } from "@/bootstrap/wizard-i18n-translator-hooks.generated";

/**
 * Resolve workspace wizard copy for the active message namespace.
 * Phase 4bh — single dynamic `useTranslations(activeNs)` (platform `wizard` when unbound).
 * Generated code no longer fans out `useTranslations` across every product namespace.
 */
export function useWorkspaceWizardTranslator(wizardMessageNamespace?: string) {
  const activeNamespace =
    wizardMessageNamespace != null &&
    wizardMessageNamespace.length > 0 &&
    isWorkspaceWizardI18nNamespace(wizardMessageNamespace)
      ? wizardMessageNamespace
      : "wizard";
  const translate = useTranslations(activeNamespace);

  return useCallback((key: string) => translate(key), [translate]);
}
