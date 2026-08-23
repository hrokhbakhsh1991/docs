"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { isWorkspaceWizardI18nNamespace } from "@/bootstrap/wizard-i18n-translator-hooks.generated";

export type WorkspaceWizardTranslator = ((
  key: string,
  values?: Record<string, string | number | Date>
) => string) & {
  /** Prefer this before `t(key)` so missing keys do not log MISSING_MESSAGE in next-intl. */
  has: (key: string) => boolean;
};

/**
 * Resolve workspace wizard copy for the active message namespace.
 * Phase 4bh — single dynamic `useTranslations(activeNs)` (platform `wizard` when unbound).
 * Generated code no longer fans out `useTranslations` across every product namespace.
 *
 * Keys are relative to the active namespace (e.g. `tourKinds.mountain_day` under a workspace
 * namespace, not `workspaceId.tourKinds.mountain_day`).
 */
export function useWorkspaceWizardTranslator(
  wizardMessageNamespace?: string
): WorkspaceWizardTranslator {
  const activeNamespace =
    wizardMessageNamespace != null &&
    wizardMessageNamespace.length > 0 &&
    isWorkspaceWizardI18nNamespace(wizardMessageNamespace)
      ? wizardMessageNamespace
      : "wizard";
  const translate = useTranslations(activeNamespace);

  return useMemo(() => {
    const translator = ((key: string, values?: Record<string, string | number | Date>) =>
      values != null ? translate(key, values) : translate(key)) as WorkspaceWizardTranslator;
    translator.has = (key: string) => translate.has(key);
    return translator;
  }, [translate]);
}
