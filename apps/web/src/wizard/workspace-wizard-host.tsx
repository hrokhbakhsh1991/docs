"use client";

import React from "react";
import { PlatformWizardEngine } from "@app-tour/platform-core";
import type { RenderStepPlan } from "@app-tour/platform-core";
import type { ScopedTenantAuthz, TenantAuthz } from "@app-tour/workspace-sdk";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

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
  readonly dimensions?: Readonly<Record<string, string>>;
};

function fieldValue(draft: TourWizardDraft, fieldId: string): string {
  if (fieldId === "basics.title") {
    return draft.data.basics?.title ?? "";
  }
  if (fieldId === "details.summary") {
    return draft.data.details?.summary ?? "";
  }
  return "";
}

function setFieldValue(draft: TourWizardDraft, fieldId: string, value: string): TourWizardDraft {
  if (fieldId === "basics.title") {
    return {
      ...draft,
      data: {
        ...draft.data,
        basics: { ...draft.data.basics, title: value },
      },
    };
  }
  if (fieldId === "details.summary") {
    return {
      ...draft,
      data: {
        ...draft.data,
        details: { ...draft.data.details, summary: value },
      },
    };
  }
  return draft;
}

/**
 * Workspace wizard host — CASL gate before plugin load; deny-by-default (no wizard DOM on 403).
 */
export function WorkspaceWizardHost({
  pluginId,
  tenantId,
  workspaceId,
  authz,
  draft,
  onDraftChange,
  renderFooter,
  dimensions = { variant: "default" },
}: WorkspaceWizardHostProps) {
  const access = useMemo(
    () => ({ authz, tenantId, pluginId, workspaceId }),
    [authz, tenantId, pluginId, workspaceId],
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
        const plan = engine.buildRenderPlan({ tenantId, dimensions });
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
  }, [authorized, access, pluginId, tenantId, dimensions]);

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
          {step.fields.map((field) => (
            <WizardField
              key={field.fieldId}
              field={field}
              value={fieldValue(draft, field.fieldId)}
              onChange={(next) => onDraftChange(setFieldValue(draft, field.fieldId, next))}
            />
          ))}
        </section>
      ))}
      {renderFooter?.(draft)}
    </div>
  );
}
