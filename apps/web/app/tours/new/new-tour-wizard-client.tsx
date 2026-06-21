"use client";

import { Suspense } from "react";

import { WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS } from "@/bootstrap/wizard-create-bindings.generated";
import { useAppSession } from "@/providers/app-session-context";
import { CreateTourWizardLoadingMessage } from "@/wizard/create-tour-wizard-chrome";
import { WorkspaceCreateTourWizardShell } from "@/wizard/workspace-create-tour-shell";

import { DenaliCreateTourWizardClient } from "./denali-create-tour-wizard-client";

function NewTourWizardClientInner() {
  const session = useAppSession();
  if (WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS.has(session.pluginId)) {
    return <DenaliCreateTourWizardClient />;
  }
  return <WorkspaceCreateTourWizardShell />;
}

export function NewTourWizardClient() {
  return (
    <Suspense fallback={<CreateTourWizardLoadingMessage />}>
      <NewTourWizardClientInner />
    </Suspense>
  );
}
