"use client";

import { buildClubSitePreviewUrls } from "./build-club-site-preview";
import type { CreateClubDraft } from "./use-create-club-wizard";

export type StepReviewProps = {
  readonly draft: CreateClubDraft;
  readonly submitting: boolean;
  readonly error?: string | null;
  readonly onConfirm: () => void;
};

export function StepReview({ draft, submitting, error, onConfirm }: StepReviewProps) {
  const urls = buildClubSitePreviewUrls(draft.subdomain);

  return (
    <div className="space-y-4" data-step="review">
      <dl className="space-y-2 rounded-lg border border-border p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Subdomain</dt>
          <dd className="font-medium">{draft.subdomain.trim().toLowerCase()}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Workspace</dt>
          <dd className="font-medium">{draft.workspaceType}</dd>
        </div>
        {draft.displayName.trim().length > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Display name</dt>
            <dd className="font-medium">{draft.displayName.trim()}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Owner phone</dt>
          <dd className="font-medium">{draft.ownerPhone.trim()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Marketing URL</dt>
          <dd className="break-all">{urls.marketing}</dd>
        </div>
      </dl>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={submitting}
        onClick={onConfirm}
      >
        {submitting ? "Creating…" : "Create club"}
      </button>
    </div>
  );
}
