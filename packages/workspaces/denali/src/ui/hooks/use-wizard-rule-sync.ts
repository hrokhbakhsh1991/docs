"use client";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DenaliWizardDraftEnvelope } from "../../draft/denali-wizard-draft-binding";
import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import {
  loadDenaliWizardRulesModule,
  type DenaliWizardRulesModule,
} from "../../wizard/rules-loader";
import { resolveMainThemeFormProfileFromCatalog } from "../../wizard/denali-wizard-catalog-sanitize";
import {
  buildDenaliWizardRuleEvalContext,
  type DenaliWizardRuleEvalContext,
} from "../../wizard/denali-wizard-submit-payload";
import type { TourThemeResource } from "../adapters/catalog-types";
import { loadDenaliThemeCatalog } from "../adapters/theme-catalog-fetch";
import { persistDenaliWizardDraftChange } from "../chrome/draft-persist";

export type DenaliWizardRuleSyncGate = {
  readonly workspaceFormProfile: string;
  readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
  readonly telegramIntegrationActive?: boolean;
};

/** Phase 15.2 P15-W-B1c — load Denali rules module once. */
export function useDenaliWizardRules(): DenaliWizardRulesModule | null {
  const [denaliRules, setDenaliRules] = useState<DenaliWizardRulesModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDenaliWizardRulesModule().then((rules) => {
      if (!cancelled) {
        setDenaliRules(rules);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return denaliRules;
}

/** Phase 15.2 P15-W-B1c — theme catalog for rule eval context. */
export function useDenaliThemeCatalog(gatePublished: boolean): readonly TourThemeResource[] {
  const [themeCatalog, setThemeCatalog] = useState<readonly TourThemeResource[]>([]);

  useEffect(() => {
    if (!gatePublished) {
      setThemeCatalog([]);
      return;
    }
    let cancelled = false;
    void loadDenaliThemeCatalog()
      .then((items) => {
        if (!cancelled) {
          setThemeCatalog(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThemeCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gatePublished]);

  return themeCatalog;
}

type UseDenaliWizardRuleSyncInput = {
  readonly plugin: WorkspacePlugin;
  readonly draft: DenaliTourWizardDraft;
  readonly getEnvelope: () => DenaliWizardDraftEnvelope<DenaliTourWizardDraft> | null;
  readonly setEnvelope: (envelope: DenaliWizardDraftEnvelope<DenaliTourWizardDraft>) => void;
  readonly denaliRules: DenaliWizardRulesModule | null;
  readonly gate: DenaliWizardRuleSyncGate;
  readonly themeCatalog: readonly TourThemeResource[];
};

/**
 * Headless wizard rule sync: eval context from category/themes + invariant sanitize on each change.
 * Visibility/required overlays are applied in forms via `applyContextualFieldRules`.
 */
export function useDenaliWizardRuleSync({
  plugin,
  draft,
  getEnvelope,
  setEnvelope,
  denaliRules,
  gate,
  themeCatalog,
}: UseDenaliWizardRuleSyncInput): {
  readonly wizardRuleEvalContext: DenaliWizardRuleEvalContext;
  readonly onDraftChange: (next: DenaliTourWizardDraft) => void;
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
      ...(gate.telegramIntegrationActive !== undefined
        ? { telegramIntegrationActive: gate.telegramIntegrationActive }
        : {}),
    };
    return build != null
      ? (build(input) as DenaliWizardRuleEvalContext)
      : buildDenaliWizardRuleEvalContext(input);
  }, [
    plugin,
    gate.workspaceFormProfile,
    gate.fieldRulesOverlay,
    gate.telegramIntegrationActive,
    draft,
    themeCatalog,
  ]);

  const onDraftChange = useCallback(
    (next: DenaliTourWizardDraft) => {
      persistDenaliWizardDraftChange(next, {
        getEnvelope,
        setEnvelope,
        denaliRules,
        denaliPlugin: plugin,
        wizardRuleEvalContext,
      });
    },
    [getEnvelope, setEnvelope, denaliRules, plugin, wizardRuleEvalContext]
  );

  return { wizardRuleEvalContext, onDraftChange };
}

/** @deprecated Use {@link useDenaliWizardRuleSync} */
export const useDenaliFlatEditRuleSync = useDenaliWizardRuleSync;
