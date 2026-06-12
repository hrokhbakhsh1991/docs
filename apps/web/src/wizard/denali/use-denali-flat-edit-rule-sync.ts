"use client";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { useCallback, useMemo } from "react";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import type { TourThemeResource } from "@/features/settings/settings-module-types";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue } from "@/tours/tour-wizard-draft-path";
import type { WizardTemplateGateState } from "@/tours/wizard-template-gate-logic";
import { resolveMainThemeFormProfileFromCatalog } from "@/wizard/denali/denali-catalog-sanitize";
import { sanitizeDenaliWizardDraft } from "@/wizard/denali/denali-draft-form-adapter";
import {
  buildDenaliWizardRuleEvalContext,
  type DenaliWizardRuleEvalContext,
} from "@/wizard/denali/denali-wizard-ui-context";

type UseDenaliFlatEditRuleSyncInput = {
  readonly plugin: WorkspacePlugin;
  readonly draft: TourWizardDraft;
  readonly setDraft: (draft: TourWizardDraft) => void;
  readonly denaliRules: DenaliWizardRulesModule | null;
  readonly gate: Pick<WizardTemplateGateState, "workspaceFormProfile" | "fieldRulesOverlay">;
  readonly themeCatalog: readonly TourThemeResource[];
};

/**
 * Headless edit rule sync: eval context from category/themes + invariant sanitize on each change.
 * Visibility/required overlays are applied in `DenaliFlatEditForm` via `applyContextualFieldRules`.
 */
export function useDenaliFlatEditRuleSync({
  plugin,
  draft,
  setDraft,
  denaliRules,
  gate,
  themeCatalog,
}: UseDenaliFlatEditRuleSyncInput): {
  readonly wizardRuleEvalContext: DenaliWizardRuleEvalContext;
  readonly onDraftChange: (next: TourWizardDraft) => void;
} {
  const wizardRuleEvalContext = useMemo(() => {
    const build = plugin.wizardHost?.buildRuleEvalContext;
    const input = {
      workspaceFormProfile: gate.workspaceFormProfile,
      fieldRulesOverlay: gate.fieldRulesOverlay,
      mainThemeFormProfile: resolveMainThemeFormProfileFromCatalog(
        getCanonicalValue(draft, "program.themeIds"),
        themeCatalog
      ),
    };
    return build != null
      ? (build(input) as DenaliWizardRuleEvalContext)
      : buildDenaliWizardRuleEvalContext(input);
  }, [plugin, gate.workspaceFormProfile, gate.fieldRulesOverlay, draft, themeCatalog]);

  const onDraftChange = useCallback(
    (next: TourWizardDraft) => {
      const sanitized =
        denaliRules != null && plugin.wizardHost?.sanitizeWizardDraft != null
          ? (plugin.wizardHost.sanitizeWizardDraft({
              draft: next as unknown as Record<string, unknown>,
              rulesModule: denaliRules,
              evalContext: wizardRuleEvalContext,
            }) as TourWizardDraft)
          : denaliRules != null
            ? sanitizeDenaliWizardDraft(next, denaliRules, wizardRuleEvalContext)
            : next;
      setDraft(sanitized);
    },
    [denaliRules, plugin, wizardRuleEvalContext, setDraft]
  );

  return { wizardRuleEvalContext, onDraftChange };
}
