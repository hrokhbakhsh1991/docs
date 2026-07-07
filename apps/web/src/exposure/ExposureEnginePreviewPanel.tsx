"use client";

import { Badge } from "@/components/ui/badge";
import type {
  ExposureControlPlaneEventContext,
  ExposureControlPlaneFieldDecision,
} from "@/exposure/exposure-control-plane-client";

export const EXPOSURE_ENGINE_PREVIEW_TEST_IDS = {
  root: "exposure-engine-preview-panel",
  field: "exposure-engine-preview-field",
} as const;

type ExposureEnginePreviewPanelProps = {
  readonly context: ExposureControlPlaneEventContext;
  readonly labels: {
    readonly title: string;
    readonly empty: string;
    readonly samplePayload: string;
    readonly engineSelected: string;
    readonly reasonChain: string;
    readonly appliedPolicies: string;
    readonly noPolicies: string;
  };
};

function stateBadgeVariant(
  state: ExposureControlPlaneFieldDecision["state"],
): "default" | "secondary" | "destructive" | "outline" {
  if (state === "visible") {
    return "default";
  }
  if (state === "blocked") {
    return "destructive";
  }
  return "outline";
}

export function ExposureEnginePreviewPanel({
  context,
  labels,
}: ExposureEnginePreviewPanelProps) {
  const preview = context.enginePreview;
  if (preview === null) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={EXPOSURE_ENGINE_PREVIEW_TEST_IDS.root}>
        {labels.empty}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid={EXPOSURE_ENGINE_PREVIEW_TEST_IDS.root}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{labels.title}</p>
        <p className="text-xs text-muted-foreground">
          {labels.samplePayload}:{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {JSON.stringify(preview.samplePayload)}
          </code>
        </p>
        <p className="text-xs text-muted-foreground">
          {labels.engineSelected}:{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {preview.engineSelectedFieldIds.length === 0
              ? "—"
              : preview.engineSelectedFieldIds.join(", ")}
          </code>
        </p>
      </div>

      <div className="space-y-3">
        {preview.decisions.map((decision) => (
          <div
            key={decision.fieldId}
            className="space-y-2 rounded-md border border-border/60 p-3"
            data-testid={EXPOSURE_ENGINE_PREVIEW_TEST_IDS.field}
            data-field-id={decision.fieldId}
            data-state={decision.state}
          >
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs">{decision.fieldId}</code>
              <Badge variant={stateBadgeVariant(decision.state)}>{decision.state}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{labels.reasonChain}</p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {decision.reasonChain.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{labels.appliedPolicies}</p>
              {decision.appliedPolicies.length === 0 ? (
                <p className="text-xs text-muted-foreground">{labels.noPolicies}</p>
              ) : (
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {decision.appliedPolicies.map((policy) => (
                    <li key={policy}>{policy}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
