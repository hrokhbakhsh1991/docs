"use client";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import type { RenderStepPlan } from "@app-tour/platform-core";
import { denaliPluginForWizardEngine, getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { DENALI_FLAT_EDIT_SECTIONS_FULL } from "@app-tour/workspace-denali/edit";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WizardTemplateStepRef } from "@/features/settings/wizard-template-types";
import { resolveDenaliStepLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";
import {
  applyWizardTemplateToRenderPlan,
  filterRenderPlanByCanonicalPaths,
} from "@/tours/wizard-template-gate-logic";
import { resolveWizardStepLabel } from "@/wizard/wizard-step-shell-logic";

import { WizardField } from "../wizard-field";
import {
  filterFlatEditRenderSteps,
  filterFlatEditTemplateSteps,
} from "./denali-flat-edit-plan";

function readWorkspaceFormProfileFromEvalContext(ctx: unknown): string | undefined {
  if (ctx == null || typeof ctx !== "object") {
    return undefined;
  }
  const uiOptions = (ctx as { uiOptions?: { workspaceFormProfile?: unknown } }).uiOptions;
  const profile = uiOptions?.workspaceFormProfile;
  return typeof profile === "string" ? profile : undefined;
}

function resolveWizardDimensions(
  plugin: WorkspacePlugin,
  draft: TourWizardDraft,
  rulesModule: DenaliWizardRulesModule | null
): Record<string, string> {
  const hooks = plugin.wizardHost;
  if (hooks?.resolveMatrixDimensionsFromDraft != null) {
    return {
      ...hooks.resolveMatrixDimensionsFromDraft(draft as unknown as Record<string, unknown>, rulesModule),
    };
  }
  return { category: "mountain", duration: "single_day" };
}

export const DENALI_FLAT_EDIT_TEST_IDS = {
  form: "operator-tour-edit-flat-form",
  section: (stepId: string) => `operator-tour-edit-section-${stepId}`,
} as const;

type DenaliFlatEditFormProps = {
  readonly tenantId: string;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly templateSteps: readonly WizardTemplateStepRef[];
  readonly allowedCanonicalPaths: readonly string[];
  readonly wizardRuleEvalContext?: unknown;
  readonly wizardSessionId?: string;
  readonly sectionIds?: readonly string[];
  readonly footer?: ReactNode;
  readonly denaliRulesModule?: DenaliWizardRulesModule | null;
};

export function DenaliFlatEditForm({
  tenantId,
  draft,
  onDraftChange,
  templateSteps,
  allowedCanonicalPaths,
  wizardRuleEvalContext,
  wizardSessionId,
  sectionIds = DENALI_FLAT_EDIT_SECTIONS_FULL,
  footer,
  denaliRulesModule = null,
}: DenaliFlatEditFormProps) {
  const tWizard = useTranslations("wizard");
  const tDenali = useTranslations("denali");
  const plugin = useMemo(() => getDenaliWorkspacePlugin(), []);
  const [baseSteps, setBaseSteps] = useState<readonly RenderStepPlan[] | null>(null);
  const [loadedRulesModule, setLoadedRulesModule] = useState<DenaliWizardRulesModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rulesModule = denaliRulesModule ?? loadedRulesModule;

  const dimensionsKey = useMemo(() => {
    const hooks = plugin.wizardHost;
    if (hooks?.resolveMatrixDimensionsFromDraft != null) {
      const dims = hooks.resolveMatrixDimensionsFromDraft(
        draft as unknown as Record<string, unknown>,
        rulesModule
      );
      return Object.entries(dims)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join("|");
    }
    return "static";
  }, [plugin, rulesModule, draft]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let rules = denaliRulesModule;
        if (rules === null) {
          const hooks = plugin.wizardHost;
          rules =
            hooks?.loadRulesModule != null
              ? ((await hooks.loadRulesModule()) as DenaliWizardRulesModule)
              : null;
          if (!cancelled) {
            setLoadedRulesModule(rules);
          }
        }
        const engine = PlatformWizardEngine.create(denaliPluginForWizardEngine(plugin));
        engine.init();
        const plan = engine.buildRenderPlan({
          tenantId,
          dimensions: resolveWizardDimensions(plugin, draft, rules),
        });
        if (!cancelled) {
          setBaseSteps(plan);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "FLAT_EDIT_LOAD_FAILED");
          setBaseSteps(null);
          if (denaliRulesModule === null) {
            setLoadedRulesModule(null);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plugin, tenantId, dimensionsKey, denaliRulesModule, draft]);

  const flatTemplateSteps = useMemo(
    () => filterFlatEditTemplateSteps(templateSteps, sectionIds),
    [templateSteps, sectionIds]
  );

  const visibleSteps = useMemo(() => {
    if (baseSteps == null) {
      return null;
    }
    let steps =
      flatTemplateSteps.length > 0
        ? applyWizardTemplateToRenderPlan(baseSteps, flatTemplateSteps)
        : allowedCanonicalPaths.length > 0
          ? filterRenderPlanByCanonicalPaths(baseSteps, allowedCanonicalPaths)
          : baseSteps;

    steps = filterFlatEditRenderSteps(steps, sectionIds);

    const hooks = plugin.wizardHost;
    if (hooks?.applyContextualFieldRules != null && rulesModule != null) {
      steps = hooks.applyContextualFieldRules({
        steps,
        draft: draft as unknown as Record<string, unknown>,
        rulesModule,
        evalContext: wizardRuleEvalContext ?? null,
      }) as typeof steps;
    }

    return steps;
  }, [
    baseSteps,
    flatTemplateSteps,
    allowedCanonicalPaths,
    sectionIds,
    plugin,
    rulesModule,
    draft,
    wizardRuleEvalContext,
  ]);

  const resolveDefaultStepLabel = useCallback(
    (stepId: string) => resolveDenaliStepLabel(tDenali, stepId),
    [tDenali]
  );

  const workspaceFormProfile = readWorkspaceFormProfileFromEvalContext(wizardRuleEvalContext);
  const wizardHost = plugin.wizardHost;

  if (error != null) {
    return (
      <p role="alert" data-denali-flat-edit-error>
        {tWizard("host.loadError", { error })}
      </p>
    );
  }

  if (visibleSteps == null || rulesModule == null) {
    return <p data-denali-flat-edit-loading>{tWizard("host.loading")}</p>;
  }

  return (
    <form
      className="denali-flat-edit-form space-y-6"
      data-denali-flat-edit-form
      data-new-tour-wizard
      data-testid={DENALI_FLAT_EDIT_TEST_IDS.form}
      onSubmit={(event) => event.preventDefault()}
    >
      {visibleSteps.map((step) => {
        const sectionLabel = resolveWizardStepLabel(
          step.stepId,
          flatTemplateSteps,
          resolveDefaultStepLabel
        );
        const visibleFields = step.fields.filter((field) => !field.hidden);
        if (visibleFields.length === 0) {
          return null;
        }
        return (
          <Card
            key={step.stepId}
            data-denali-surface="card"
            data-denali-flat-edit-section={step.stepId}
            data-testid={DENALI_FLAT_EDIT_TEST_IDS.section(step.stepId)}
            className="shadow-sm"
          >
            <CardHeader>
              <CardTitle className="text-lg">{sectionLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleFields.map((field) => {
                const path = field.canonicalPath;
                const value = getCanonicalStringValue(draft, path);
                return (
                  <div key={`${field.fieldId}:${path}`} className="denali-flat-edit-form__field">
                    <WizardField
                      field={field}
                      value={value}
                      onChange={(next) => onDraftChange(setCanonicalStringValue(draft, path, next))}
                      draft={draft}
                      onDraftChange={onDraftChange}
                      pluginId="denali"
                      compositeSurfaceId={wizardHost?.compositeSurfaceId}
                      fieldLabelSurfaceId={wizardHost?.fieldLabelSurfaceId}
                      wizardSessionId={wizardSessionId}
                      workspaceFormProfile={workspaceFormProfile}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
      {footer}
    </form>
  );
}
