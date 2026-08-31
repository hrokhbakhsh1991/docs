"use client";

import { OPERATOR_SUCCESS_TEXT_SM_CLASS } from "@/admin/patterns/operator-semantic-surfaces";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { fetchPlatformApi } from "../platform-api-client";
import { summarizeBuilderPreview } from "./preview-builder-draft";
import type { BuilderDraft } from "./builder-draft-state";
import { clearBuilderDraftSessionStorage } from "./builder-draft-state";

export type PublishBarProps = {
  readonly definitionId: string;
  readonly draft: BuilderDraft;
  readonly isOwner: boolean;
};

export function PublishBar({ definitionId, draft, isOwner }: PublishBarProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const summary = summarizeBuilderPreview(draft.payload);
  const canPublish = isOwner && summary.violationCount === 0;

  const onPublish = useCallback(async () => {
    if (!canPublish) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/workspace-definitions/${definitionId}/versions`, {
        method: "POST",
        body: JSON.stringify({ payload: draft.payload }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        version?: number;
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        setError(body.error ?? body.code ?? "Publish failed");
        return;
      }
      clearBuilderDraftSessionStorage(definitionId);
      setPublishedVersion(body.version ?? null);
      router.refresh();
    } catch {
      setError("Publish failed");
    } finally {
      setBusy(false);
    }
  }, [canPublish, definitionId, draft.payload, router]);

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Publish</h2>
          <p className="text-xs text-muted-foreground">
            Owner-only · immutable version INSERT on server
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={!canPublish || busy}
          data-publish-disabled={canPublish ? undefined : isOwner ? "validation" : "role"}
          onClick={() => void onPublish()}
        >
          {busy ? "Publishing…" : "Publish version"}
        </button>
      </div>
      {!isOwner ? (
        <p className="text-sm text-muted-foreground">Only platform owners can publish definitions.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {publishedVersion !== null ? (
        <p className={OPERATOR_SUCCESS_TEXT_SM_CLASS}>Published version {publishedVersion}.</p>
      ) : null}
    </section>
  );
}
