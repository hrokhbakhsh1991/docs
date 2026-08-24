/**
 * MAT-012 — bounded workspace SLO telemetry primitives (no PII / unbounded IDs in labels).
 */
import { logger } from "./logger";
import { metricsRegistry } from "./metrics";

export type WorkspaceSloArea =
  | "api"
  | "registration"
  | "publish_write"
  | "portal_auth"
  | "finance";

export type WorkspaceSloOutcome = "success" | "error";

export type WorkspaceSloEvent = {
  readonly area: WorkspaceSloArea;
  readonly outcome: WorkspaceSloOutcome;
  readonly workspaceType: string;
  readonly tenantId?: string;
  readonly durationMs?: number;
  readonly validationStage?: "shared" | "capability" | "workspacePolicy";
  readonly capabilityId?: string;
};

const ALLOWED_VALIDATION_STAGES = new Set(["shared", "capability", "workspacePolicy"]);

function assertBoundedLabel(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    throw new Error(`WORKSPACE_SLO_LABEL_INVALID:${label}`);
  }
  if (trimmed.includes("@")) {
    throw new Error(`WORKSPACE_SLO_PII_LABEL_FORBIDDEN:${label}`);
  }
  return trimmed;
}

export function recordWorkspaceSloEvent(event: WorkspaceSloEvent): void {
  const workspaceType = assertBoundedLabel(event.workspaceType, "workspaceType");
  const labels: Record<string, string> = {
    area: event.area,
    outcome: event.outcome,
    workspace_type: workspaceType,
  };
  if (event.tenantId !== undefined) {
    labels.tenant_id = assertBoundedLabel(event.tenantId, "tenantId");
  }
  if (event.validationStage !== undefined) {
    if (!ALLOWED_VALIDATION_STAGES.has(event.validationStage)) {
      throw new Error(`WORKSPACE_SLO_VALIDATION_STAGE_INVALID:${event.validationStage}`);
    }
    labels.validation_stage = event.validationStage;
  }
  if (event.capabilityId !== undefined) {
    labels.capability_id = assertBoundedLabel(event.capabilityId, "capabilityId");
  }

  metricsRegistry.increment("workspace_slo_event_total", labels);
  if (event.durationMs !== undefined && Number.isFinite(event.durationMs)) {
    metricsRegistry.observe("workspace_slo_latency_ms", event.durationMs, labels);
  }

  logger.info(
    {
      event: "workspace.slo",
      area: event.area,
      outcome: event.outcome,
      workspaceType,
      ...(event.tenantId !== undefined ? { tenantId: event.tenantId } : {}),
      ...(event.validationStage !== undefined ? { validationStage: event.validationStage } : {}),
      ...(event.capabilityId !== undefined ? { capabilityId: event.capabilityId } : {}),
      ...(event.durationMs !== undefined ? { durationMs: Math.round(event.durationMs) } : {}),
    },
    "workspace slo event"
  );
}

export function recordValidationPipelineSloEvent(input: {
  readonly workspaceType: string;
  readonly tenantId?: string;
  readonly stage: "shared" | "capability" | "workspacePolicy";
  readonly outcome: WorkspaceSloOutcome;
  readonly capabilityId?: string;
  readonly durationMs?: number;
}): void {
  recordWorkspaceSloEvent({
    area: "publish_write",
    outcome: input.outcome,
    workspaceType: input.workspaceType,
    tenantId: input.tenantId,
    validationStage: input.stage,
    capabilityId: input.capabilityId,
    durationMs: input.durationMs,
  });
}

export function recordRegistrationSloEvent(input: {
  readonly workspaceType: string;
  readonly tenantId: string;
  readonly outcome: WorkspaceSloOutcome;
  readonly durationMs?: number;
}): void {
  recordWorkspaceSloEvent({
    area: "registration",
    outcome: input.outcome,
    workspaceType: input.workspaceType,
    tenantId: input.tenantId,
    durationMs: input.durationMs,
  });
}
