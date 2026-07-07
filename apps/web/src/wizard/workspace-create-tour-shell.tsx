"use client";

import { useAppSession } from "@/providers/app-session-context";

import { WorkspaceCreateTourWizardClient } from "./workspace-create-tour-wizard-client";

/** Generic create-tour entry — delegates to Phase 14.3 orchestrator. */
export function WorkspaceCreateTourWizardShell() {
  const session = useAppSession();
  return <WorkspaceCreateTourWizardClient pluginId={session.pluginId} />;
}
