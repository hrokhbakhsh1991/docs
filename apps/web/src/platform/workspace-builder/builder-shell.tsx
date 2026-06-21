"use client";

import { useEffect, useMemo, useReducer } from "react";

import { FieldInspector } from "./field-inspector";
import { FieldPalette } from "./field-palette";
import { PreviewPanel } from "./preview-panel";
import { PublishBar } from "./publish-bar";
import { RuleMatrixEditor } from "./rule-matrix-editor";
import { WizardCanvas } from "./wizard-canvas";
import {
  createInitialBuilderDraft,
  findDuplicateFieldIds,
  readBuilderDraftFromSessionStorage,
  reduceBuilderDraft,
  writeBuilderDraftToSessionStorage,
  type BuilderDraft,
} from "./builder-draft-state";

export type BuilderShellProps = {
  readonly definitionId: string;
  readonly displayName: string;
  readonly basedOnVersion: number | null;
  readonly initialPayload: BuilderDraft["payload"] | null;
  readonly isOwner: boolean;
};

export function BuilderShell({
  definitionId,
  displayName,
  basedOnVersion,
  initialPayload,
  isOwner,
}: BuilderShellProps) {
  const seedDraft = useMemo(
    () =>
      createInitialBuilderDraft({
        definitionId,
        basedOnVersion,
        payload: initialPayload ?? undefined,
      }),
    [basedOnVersion, definitionId, initialPayload]
  );

  const [draft, dispatch] = useReducer(reduceBuilderDraft, seedDraft);

  useEffect(() => {
    const stored = readBuilderDraftFromSessionStorage(definitionId);
    if (stored && stored.meta.editedAt > seedDraft.meta.editedAt) {
      dispatch({ type: "replace", draft: stored });
    }
  }, [definitionId, seedDraft.meta.editedAt]);

  useEffect(() => {
    writeBuilderDraftToSessionStorage(definitionId, draft);
  }, [definitionId, draft]);

  const duplicateFieldIds = findDuplicateFieldIds(draft.payload);

  return (
    <div className="space-y-6" data-platform-builder>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
        <p className="text-sm text-muted-foreground">
          {definitionId}
          {basedOnVersion !== null ? ` · based on v${basedOnVersion}` : " · unpublished draft"}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <FieldPalette draft={draft} dispatch={dispatch} />
        <WizardCanvas draft={draft} duplicateFieldIds={duplicateFieldIds} dispatch={dispatch} />
        <FieldInspector draft={draft} dispatch={dispatch} />
      </div>

      <RuleMatrixEditor draft={draft} dispatch={dispatch} />
      <PreviewPanel payload={draft.payload} />
      <PublishBar definitionId={definitionId} draft={draft} isOwner={isOwner} />
    </div>
  );
}
