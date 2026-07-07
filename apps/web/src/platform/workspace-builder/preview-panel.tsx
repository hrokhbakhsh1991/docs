"use client";

import type { WorkspaceDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { summarizeBuilderPreview } from "./preview-builder-draft";

export type PreviewPanelProps = {
  readonly payload: WorkspaceDefinitionPayload;
};

export function PreviewPanel({ payload }: PreviewPanelProps) {
  const summary = summarizeBuilderPreview(payload);

  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      data-platform-builder-preview
      data-preview-violation-count={summary.violationCount}
    >
      <h2 className="text-sm font-semibold">Preview</h2>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <p>Steps: {summary.stepCount}</p>
        <p>Visible fields: {summary.fieldCount}</p>
        <p>Violations: {summary.violationCount}</p>
      </div>
      {summary.violations.length > 0 ? (
        <ul className="space-y-1 text-sm text-destructive">
          {summary.violations.map((violation) => (
            <li key={violation}>{violation}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Draft passes validation and render-plan preview.</p>
      )}
    </section>
  );
}
