"use client";

import { Suspense } from "react";

import { isExtendedOperatorWorkspace } from "@/workspace/is-extended-operator-workspace";
import { useAppSession } from "@/providers/app-session-context";
import { CreateTourWizardLoadingMessage } from "@/wizard/create-tour-wizard-chrome";
import { WorkspaceCreateTourWizardShell } from "@/wizard/workspace-create-tour-shell";

import { OperatorCreateTourWizardClient } from "./create-tour-wizard-client";

type NewTourWizardClientProps = {
  readonly initialTemplateResponse?: unknown | null;
  readonly initialLocationsResponse?: unknown | null;
};

function NewTourWizardClientInner(props: NewTourWizardClientProps) {
  const session = useAppSession();
  if (isExtendedOperatorWorkspace(session.pluginId)) {
    return <OperatorCreateTourWizardClient {...props} />;
  }
  return <WorkspaceCreateTourWizardShell />;
}

export function NewTourWizardClient(props: NewTourWizardClientProps) {
  return (
    <Suspense fallback={<CreateTourWizardLoadingMessage />}>
      <NewTourWizardClientInner {...props} />
    </Suspense>
  );
}
