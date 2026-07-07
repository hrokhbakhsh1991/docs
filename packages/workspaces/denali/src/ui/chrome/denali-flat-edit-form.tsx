"use client";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import type { RenderFieldPlan, RenderStepPlan } from "@app-tour/platform-core";
import { denaliPluginForWizardEngine, getDenaliWorkspacePlugin } from "../../denali.plugin";
import { DENALI_FLAT_EDIT_SECTIONS_FULL } from "../../edit";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { DenaliWizardRulesModule } from "../../wizard/rules-loader";
import type { WizardTemplateStepRef } from "../adapters/catalog-types";
import { resolveDenaliStepLabel } from "../adapters/field-labels";
import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../hooks/use-latest-wizard-draft";
import { DENALI_FLAT_EDIT_TEST_IDS } from "../test-ids/denali-flat-edit-test-ids";
import { resolveDenaliFlatEditSectionLabel } from "./flat-edit-section-label";
import {
  filterFlatEditRenderSteps,
  filterFlatEditTemplateSteps,
} from "./flat-edit-plan";

export { DENALI_FLAT_EDIT_TEST_IDS };

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
  draft: DenaliTourWizardDraft,
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

export type DenaliFlatEditRenderPlanOverlay = {
  readonly applyTemplateToRenderPlan: (
    baseSteps: readonly RenderStepPlan[],
    templateSteps: readonly WizardTemplateStepRef[]
  ) => readonly RenderStepPlan[];
  readonly filterRenderPlanByCanonicalPaths: (
    steps: readonly RenderStepPlan[],
    paths: readonly string[]
  ) => readonly RenderStepPlan[];
};

export type DenaliFlatEditFieldRenderProps = {
  readonly field: RenderFieldPlan;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly pluginId: "denali";
  readonly compositeSurfaceId?: string;
  readonly fieldLabelSurfaceId?: string;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
};

export type DenaliFlatEditFormProps = {
  readonly tenantId: string;
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly templateSteps: readonly WizardTemplateStepRef[];
  readonly allowedCanonicalPaths: readonly string[];
  readonly wizardRuleEvalContext?: unknown;
  readonly wizardSessionId?: string;
  readonly navLocked?: boolean;
  readonly sectionIds?: readonly string[];
  readonly footer?: ReactNode;
  readonly renderPlanOverlay: DenaliFlatEditRenderPlanOverlay;
  readonly renderField: (props: DenaliFlatEditFieldRenderProps) => ReactNode;
};

export function DenaliFlatEditForm({
  tenantId,
  draft,
  onDraftChange,
  templateSteps,
  allowedCanonicalPaths,
  wizardRuleEvalContext,
  wizardSessionId,
  navLocked = false,
  sectionIds = DENALI_FLAT_EDIT_SECTIONS_FULL,
  footer,
  renderPlanOverlay,
  renderField,
}: DenaliFlatEditFormProps) {
  const tWizard = useTranslations("wizard");
  const tDenali = useTranslations("denali");
  const draftEditBaseRef = useLatestWizardDraft(draft);
  const plugin = useMemo(() => getDenaliWorkspacePlugin(), []);
  const [baseSteps, setBaseSteps] = useState<readonly RenderStepPlan[] | null>(null);
  const [rulesModule, setRulesModule] = useState<DenaliWizardRulesModule | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const hooks = plugin.wizardHost;
        const rules =
          hooks?.loadRulesModule != null
            ? ((await hooks.loadRulesModule()) as DenaliWizardRulesModule)
            : null;
        const engine = PlatformWizardEngine.create(denaliPluginForWizardEngine(plugin));
        engine.init();
        const plan = engine.buildRenderPlan({
          tenantId,
          dimensions: resolveWizardDimensions(plugin, draft, rules),
        });
        if (!cancelled) {
          setRulesModule(rules);
          setBaseSteps(plan);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "FLAT_EDIT_LOAD_FAILED");
          setBaseSteps(null);
          setRulesModule(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plugin, tenantId, dimensionsKey]);

  const flatTemplateSteps = useMemo(
    () => filterFlatEditTemplateSteps(templateSteps, sectionIds),
    [templateSteps, sectionIds]
  );

  const resolveDefaultStepLabel = useCallback(
    (stepId: string) => resolveDenaliStepLabel(tDenali, stepId),
    [tDenali]
  );

  const visibleSteps = useMemo(() => {
    if (baseSteps == null) {
      return null;
    }
    let steps =
      flatTemplateSteps.length > 0
        ? renderPlanOverlay.applyTemplateToRenderPlan(baseSteps, flatTemplateSteps)
        : allowedCanonicalPaths.length > 0
          ? renderPlanOverlay.filterRenderPlanByCanonicalPaths(baseSteps, allowedCanonicalPaths)
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
    renderPlanOverlay,
  ]);

  const workspaceFormProfile = readWorkspaceFormProfileFromEvalContext(wizardRuleEvalContext);
  const wizardHost = plugin.wizardHost;

  if (error != null) {
    return (
      <p role="alert" data-denali-flat-edit-error>
        {tWizard("host.loadError", { error })}
      </p>
    );
  }

  if (visibleSteps == null) {
    return <p data-denali-flat-edit-loading>{tWizard("host.loading")}</p>;
  }

  return (
    <form
      className="denali-flat-edit-form space-y-6"
      data-denali-flat-edit-form
      data-testid={DENALI_FLAT_EDIT_TEST_IDS.form}
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset disabled={navLocked} className="space-y-6 border-0 p-0 m-0 min-w-0">
        {visibleSteps.map((step) => {
          const sectionLabel = resolveDenaliFlatEditSectionLabel(
            step.stepId,
            flatTemplateSteps,
            resolveDefaultStepLabel
          );
          const visibleFields = step.fields.filter((field) => !field.hidden);
          if (visibleFields.length === 0) {
            return null;
          }
          return (
            <section
              key={step.stepId}
              data-denali-surface="card"
              data-denali-flat-edit-section={step.stepId}
              data-testid={DENALI_FLAT_EDIT_TEST_IDS.section(step.stepId)}
              className="rounded-xl border bg-card text-card-foreground shadow-sm"
            >
              <header className="flex flex-col space-y-1.5 p-6">
                <h2 className="text-lg font-semibold leading-none tracking-tight">{sectionLabel}</h2>
              </header>
              <div className="space-y-4 p-6 pt-0">
                {visibleFields.map((field) => {
                  const path = field.canonicalPath;
                  const value = getCanonicalStringValue(draft, path);
                  return (
                    <div key={`${field.fieldId}:${path}`} className="denali-flat-edit-form__field">
                      {renderField({
                        field,
                        value,
                        onChange: (next) =>
                          commitWizardDraftEdit(draftEditBaseRef, onDraftChange, (base) =>
                            setCanonicalStringValue(base, path, next)
                          ),
                        draft,
                        onDraftChange,
                        pluginId: "denali",
                        compositeSurfaceId: wizardHost?.compositeSurfaceId,
                        fieldLabelSurfaceId: wizardHost?.fieldLabelSurfaceId ?? "denali",
                        wizardSessionId,
                        workspaceFormProfile,
                        translateWorkspaceMessage: tDenali,
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </fieldset>
      {footer}
    </form>
  );
}
