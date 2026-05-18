export type WorkspaceTourWizardDraftRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  envelope: Record<string, unknown>;
  wizardContractVersion: number;
  rowVersion: number;
  updatedAt: string;
};

export type WorkspaceTourWizardDraftEnvelope = {
  draft: WorkspaceTourWizardDraftRecord | null;
};

export async function fetchWorkspaceTourWizardDraft(): Promise<WorkspaceTourWizardDraftEnvelope> {
  const res = await fetch("/api/settings/tour-wizard-draft", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`fetchWorkspaceTourWizardDraft: ${res.status}`);
  }
  return (await res.json()) as WorkspaceTourWizardDraftEnvelope;
}

export async function patchWorkspaceTourWizardDraft(body: {
  envelope: Record<string, unknown>;
  rowVersion?: number;
  wizardContractVersion?: number;
}): Promise<WorkspaceTourWizardDraftEnvelope> {
  const res = await fetch("/api/settings/tour-wizard-draft", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`patchWorkspaceTourWizardDraft: ${res.status}`);
  }
  return (await res.json()) as WorkspaceTourWizardDraftEnvelope;
}

export async function deleteWorkspaceTourWizardDraft(): Promise<void> {
  const res = await fetch("/api/settings/tour-wizard-draft", {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`deleteWorkspaceTourWizardDraft: ${res.status}`);
  }
}
