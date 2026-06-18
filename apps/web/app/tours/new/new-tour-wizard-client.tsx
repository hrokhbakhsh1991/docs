"use client";

import { useAppSession } from "@/providers/app-session-context";
import { WorkspaceCreateTourWizardShell } from "@/wizard/workspace-create-tour-shell";

import { DenaliCreateTourWizardClient } from "./denali-create-tour-wizard-client";

export function NewTourWizardClient() {
  const session = useAppSession();
  if (session.pluginId === "denali") {
    return <DenaliCreateTourWizardClient />;
  }
  return <WorkspaceCreateTourWizardShell />;
}
