"use client";

import type { CreateClubDraft } from "./use-create-club-wizard";

export type StepOwnerProps = {
  readonly draft: CreateClubDraft;
  readonly onChange: (patch: Partial<CreateClubDraft>) => void;
  readonly error?: string | null;
};

export function StepOwner({ draft, onChange, error }: StepOwnerProps) {
  return (
    <div className="space-y-4" data-step="owner">
      <div>
        <label htmlFor="club-owner-phone" className="mb-1 block text-sm font-medium">
          Owner phone
        </label>
        <input
          id="club-owner-phone"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={draft.ownerPhone}
          onChange={(event) => onChange({ ownerPhone: event.target.value })}
          placeholder="+98…"
          inputMode="tel"
          autoComplete="tel"
        />
      </div>
      <div>
        <label htmlFor="club-owner-note" className="mb-1 block text-sm font-medium">
          Owner note
        </label>
        <input
          id="club-owner-note"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={draft.ownerNameNote}
          onChange={(event) => onChange({ ownerNameNote: event.target.value })}
          placeholder="Optional"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
