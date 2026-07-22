"use client";

import { useEffect, useState } from "react";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  OperatorCreateTourWizardCatalogShell,
  OperatorCreateTourWizardClientReady,
} from "./create-tour-wizard-client-ready";
import { CreateTourWizardLoadingMessage } from "@/wizard/create-tour-wizard-chrome";
import { useAppSession } from "@/providers/app-session-context";
import { warmOperatorWizardShell } from "@/wizard/warm-operator-wizard-shell";

type OperatorCreateTourWizardClientProps = {
  readonly initialTemplateResponse?: unknown | null;
  readonly initialLocationsResponse?: unknown | null;
};

/**
 * Wave I.9 — load plugin via registry (session.pluginId), then mount orchestration.
 * Gap Closure B.5 — warm dynamic binders via `warmOperatorWizardShell`.
 * @see docs/dev/wave-i-9-create-wizard-async-plugin.mdoc
 * @see docs/dev/saas-platform-remediation.mdoc
 */
export function OperatorCreateTourWizardClient({
  initialTemplateResponse = null,
  initialLocationsResponse = null,
}: OperatorCreateTourWizardClientProps) {
  const session = useAppSession();
  const [plugin, setPlugin] = useState<WorkspacePlugin | null>(null);

  useEffect(() => {
    let cancelled = false;
    void warmOperatorWizardShell(session.pluginId).then((loaded) => {
      if (!cancelled) {
        setPlugin(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);

  if (plugin == null) {
    return (
      <OperatorCreateTourWizardCatalogShell initialLocationsResponse={initialLocationsResponse}>
        <CreateTourWizardLoadingMessage />
      </OperatorCreateTourWizardCatalogShell>
    );
  }

  return (
    <OperatorCreateTourWizardCatalogShell initialLocationsResponse={initialLocationsResponse}>
      <OperatorCreateTourWizardClientReady
        plugin={plugin}
        initialTemplateResponse={initialTemplateResponse}
      />
    </OperatorCreateTourWizardCatalogShell>
  );
}
