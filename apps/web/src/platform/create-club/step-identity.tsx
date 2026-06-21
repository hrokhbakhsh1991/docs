"use client";

import type { CreateClubDraft, WorkspaceOption } from "./use-create-club-wizard";

export type StepIdentityProps = {
  readonly draft: CreateClubDraft;
  readonly workspaces: readonly WorkspaceOption[];
  readonly onChange: (patch: Partial<CreateClubDraft>) => void;
  readonly error?: string | null;
};

export function StepIdentity({ draft, workspaces, onChange, error }: StepIdentityProps) {
  return (
    <div className="space-y-4" data-step="identity">
      <div>
        <label htmlFor="club-display-name" className="mb-1 block text-sm font-medium">
          Display name
        </label>
        <input
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
        <input
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
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.displayName ?? workspace.id}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
