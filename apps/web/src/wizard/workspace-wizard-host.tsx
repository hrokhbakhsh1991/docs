"use client";

import React from "react";
import { PlatformWizardEngine } from "@app-tour/platform-core";
import type { RenderStepPlan } from "@app-tour/platform-core";
import type { ScopedTenantAuthz, TenantAuthz } from "@app-tour/workspace-sdk";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import { canLoadWorkspaceWizard } from "./wizard-access";
import { WizardAccessDenied } from "./wizard-access-denied";
import { loadWorkspacePluginById } from "./load-workspace-plugin";
import { WizardField } from "./wizard-field";

export type WorkspaceWizardHostProps = {
  readonly pluginId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly authz: TenantAuthz | ScopedTenantAuthz;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly renderFooter?: (draft: TourWizardDraft) => ReactNode;
};

function resolveWizardDimensions(
  plugin: Awaited<ReturnType<typeof loadWorkspacePluginById>>,
  validationVariant: "default" | "basic" = "default"
): Record<string, string> {
  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: validationVariant };
  }
  if (matrix.includes("category") && matrix.includes("duration")) {
    return { category: "mountain", duration: "single_day" };
  }
  return Object.fromEntries(matrix.map((key) => [key, validationVariant]));
}

/**
 * Workspace wizard host — CASL gate before plugin load; deny-by-default (no wizard DOM on 403).
 * Field binding follows {@link RenderFieldPlan} from the platform engine (canonicalPath, kind, hidden).
 */
export function WorkspaceWizardHost({
  pluginId,
  tenantId,
  workspaceId,
  authz,
  draft,
  onDraftChange,
  renderFooter,
}: WorkspaceWizardHostProps) {
  const access = useMemo(
    () => ({ authz, tenantId, pluginId, workspaceId }),
    [authz, tenantId, pluginId, workspaceId]
  );

  const authorized = useMemo(() => canLoadWorkspaceWizard(access), [access]);

  const [steps, setSteps] = useState<readonly RenderStepPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) {
      setSteps(null);
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (!canLoadWorkspaceWizard(access)) {
          return;
        }
        const plugin = await loadWorkspacePluginById(pluginId);
        const engine = PlatformWizardEngine.create(plugin);
        engine.init();
        const plan = engine.buildRenderPlan({
          tenantId,
          dimensions: resolveWizardDimensions(plugin),
        });
        if (!cancelled) {
          setSteps(plan);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : "wizard_load_failed";
          setError(message);
          setSteps(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorized, access, pluginId, tenantId]);

  if (!authorized) {
    return <WizardAccessDenied />;
  }

  if (error) {
    return (
      <div role="alert" data-workspace-wizard-error>
        <p>Wizard failed to load: {error}</p>
      </div>
    );
  }

  if (!steps) {
    return <p data-workspace-wizard-loading>Loading workspace wizard…</p>;
  }

  return (
    <div data-workspace-wizard data-plugin-id={pluginId}>
      {steps.map((step) => (
        <section key={step.stepId} data-wizard-step={step.stepId}>
          <h2>{step.stepId}</h2>
          {step.fields.map((field) => {
            const path = field.canonicalPath;
            const value = getCanonicalStringValue(draft, path);

            return (
              <WizardField
                key={`${field.fieldId}:${path}`}
                field={field}
                value={value}
                onChange={(next) => onDraftChange(setCanonicalStringValue(draft, path, next))}
              />
            );
          })}
        </section>
      ))}
      {renderFooter?.(draft)}
    </div>
  );
}
