"use client";

import { useEffect, useState } from "react";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  OperatorCreateTourWizardCatalogShell,
  OperatorCreateTourWizardClientReady,
} from "./create-tour-wizard-client-ready";
import {
  CreateTourWizardBootstrapFrame,
  CreateTourWizardLoadError,
  CreateTourWizardLoadingMessage,
} from "@/wizard/create-tour-wizard-chrome";
import { useAppSession } from "@/providers/app-session-context";
import {
  OperatorWizardWarmError,
  warmOperatorWizardShell,
} from "@/wizard/warm-operator-wizard-shell";

type WizardBootstrapState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly plugin: WorkspacePlugin }
  | { readonly status: "error"; readonly code: string };
type OperatorCreateTourWizardClientProps = {
  readonly initialTemplateResponse?: unknown | null;
  readonly initialLocationsResponse?: unknown | null;
};

/**
 * Wave I.9 — load plugin via registry (session.pluginId), then mount orchestration.
 * Warm via `warmOperatorWizardShell` → registry load + wizardHost.ensureReady.
 * @see docs/dev/wave-i-9-create-wizard-async-plugin.mdoc
 */
export function OperatorCreateTourWizardClient({
  initialTemplateResponse = null,
  initialLocationsResponse = null,
}: OperatorCreateTourWizardClientProps) {
  const session = useAppSession();
  const [bootstrap, setBootstrap] = useState<WizardBootstrapState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBootstrap({ status: "loading" });
    void warmOperatorWizardShell(session.pluginId)
      .then((loaded) => {
        if (!cancelled) setBootstrap({ status: "ready", plugin: loaded });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code =
          error instanceof OperatorWizardWarmError ? error.code : "WORKSPACE_PLUGIN_LOAD_FAILED";
        console.error("operator wizard bootstrap failed", {
          pluginId: session.pluginId,
          code,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        setBootstrap({ status: "error", code });
      });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId, attempt]);

  if (bootstrap.status === "loading") {
    return (
      <OperatorCreateTourWizardCatalogShell initialLocationsResponse={initialLocationsResponse}>
        <CreateTourWizardBootstrapFrame>
          <CreateTourWizardLoadingMessage />
        </CreateTourWizardBootstrapFrame>
      </OperatorCreateTourWizardCatalogShell>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <OperatorCreateTourWizardCatalogShell initialLocationsResponse={initialLocationsResponse}>
        <CreateTourWizardBootstrapFrame>
          <CreateTourWizardLoadError
            code={bootstrap.code}
            onRetry={() => setAttempt((current) => current + 1)}
          />
        </CreateTourWizardBootstrapFrame>
      </OperatorCreateTourWizardCatalogShell>
    );
  }

  return (
    <OperatorCreateTourWizardCatalogShell initialLocationsResponse={initialLocationsResponse}>
      <OperatorCreateTourWizardClientReady
        plugin={bootstrap.plugin}
        initialTemplateResponse={initialTemplateResponse}
      />
    </OperatorCreateTourWizardCatalogShell>
  );
}
