"use client";

import { Input } from "@app-tour/ui-primitives/input";

import { WorkspaceProductionCertificationBadge } from "../workspace-production-certification-badge";
import type { CreateClubDraft, WorkspaceOption } from "./use-create-club-wizard";

export type StepIdentityProps = {
  readonly draft: CreateClubDraft;
  readonly workspaces: readonly WorkspaceOption[];
  readonly onChange: (patch: Partial<CreateClubDraft>) => void;
  readonly error?: string | null;
};

function isWorkspaceOptionProductionAllowed(option: WorkspaceOption): boolean {
  if (option.productionOnboardingAllowed === true) {
    return true;
  }
  return option.productionTier === "certified";
}

export function StepIdentity({ draft, workspaces, onChange, error }: StepIdentityProps) {
  const selected = workspaces.find((workspace) => workspace.id === draft.workspaceType);

  return (
    <div className="space-y-4" data-step="identity">
      <div>
        <label htmlFor="club-display-name" className="mb-1 block text-sm font-medium">
          Display name
        </label>
        <Input
          id="club-display-name"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={draft.displayName}
          onChange={(event) => onChange({ displayName: event.target.value })}
          placeholder="Optional club label"
        />
      </div>
      <div>
        <label htmlFor="club-subdomain" className="mb-1 block text-sm font-medium">
          Subdomain
        </label>
        <Input
          id="club-subdomain"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={draft.subdomain}
          onChange={(event) => onChange({ subdomain: event.target.value.toLowerCase() })}
          placeholder="my-club"
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="club-workspace" className="mb-1 block text-sm font-medium">
          Workspace
        </label>
        <select
          id="club-workspace"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={draft.workspaceType}
          onChange={(event) => onChange({ workspaceType: event.target.value })}
        >
          <option value="">Select workspace…</option>
          {workspaces.map((workspace) => {
            const allowed = isWorkspaceOptionProductionAllowed(workspace);
            return (
              <option key={workspace.id} value={workspace.id} disabled={!allowed}>
                {workspace.displayName ?? workspace.id}
                {!allowed ? " (stub — production blocked)" : ""}
              </option>
            );
          })}
        </select>
        {selected?.productionTier ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Production tier</span>
            <WorkspaceProductionCertificationBadge tier={selected.productionTier} />
            {selected.productionTier === "stub" ? (
              <span className="text-muted-foreground">
                Stub workspaces cannot onboard production clubs.
              </span>
            ) : null}
          </div>
        ) : null}
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground" data-workspace-certification-legend>
          {workspaces.map((workspace) =>
            workspace.productionTier ? (
              <li key={workspace.id} className="flex items-center gap-2">
                <span className="font-medium text-foreground">{workspace.displayName ?? workspace.id}</span>
                <WorkspaceProductionCertificationBadge tier={workspace.productionTier} />
              </li>
            ) : null
          )}
        </ul>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
