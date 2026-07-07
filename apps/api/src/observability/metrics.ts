export type MetricLabels = Readonly<Record<string, string>>;

/** Tenant business counters — increment without `tenant_id` throws (MET-API-01 / DEC-049). */
export const TENANT_SCOPED_METRIC_NAMES = new Set<string>([
  "tour_creation_count",
  "projection_inconsistency_total",
  "projection_auto_repair_total",
  "validation_queue_shed_total",
  "validation_time_budget_exceeded_total",
  "tour_write_concurrency_shed_total",
  "outbox_relay_tenant_deferred_total",
  "outbox_projection_lag_seconds",
  "workspace_metadata_validation_errors_total",
  "integration_connection_created_total",
  "integration_connection_create_failed_total",
  "integration_delivery_success_total",
  "integration_delivery_failed_total",
  "field_exposure_engine_shadow_mismatch_total",
  "field_exposure_engine_selector_failure_total",
  "field_exposure_runtime_selection_total",
  "field_exposure_shadow_parity_mismatch_total",
  "field_exposure_cutover_selection_total",
  "field_exposure_decision_audited_total",
]);

function labelKey(labels: MetricLabels | undefined): string {
  if (!labels || Object.keys(labels).length === 0) {
    return "";
  }
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function seriesKey(name: string, labels: MetricLabels | undefined): string {
  const lk = labelKey(labels);
  return lk.length > 0 ? `${name}{${lk}}` : name;
}

export const METRIC_TENANT_LABEL_REQUIRED = "METRIC_TENANT_LABEL_REQUIRED";

function assertTenantScopedMetricLabels(name: string, labels: MetricLabels | undefined): void {
  if (!TENANT_SCOPED_METRIC_NAMES.has(name)) {
    return;
  }
  const tenantId = labels?.tenant_id?.trim();
  if (tenantId === undefined || tenantId.length === 0) {
    throw new Error(`${METRIC_TENANT_LABEL_REQUIRED}:${name}`);
  }
}

/**
 * In-process labeled counter registry (Phase 5 scaffold).
 * Phase 7 may bridge this to Prometheus text or OTLP — keep label cardinality bounded.
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();

  increment(name: string, labels?: MetricLabels, amount = 1): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    assertTenantScopedMetricLabels(name, labels);
    const key = seriesKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
  }

  getMetric(name: string, labels?: MetricLabels): number {
    return this.counters.get(seriesKey(name, labels)) ?? 0;
  }

  observe(name: string, value: number, labels?: MetricLabels): void {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    assertTenantScopedMetricLabels(name, labels);
    const key = seriesKey(name, labels);
    this.gauges.set(key, value);
  }

  getGauge(name: string, labels?: MetricLabels): number {
    return this.gauges.get(seriesKey(name, labels)) ?? 0;
  }

  /** Test-only — clears all series. */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
  }

  /** Snapshot of all counter series (name+labels key → value). */
  snapshotCounters(): ReadonlyMap<string, number> {
    return new Map(this.counters);
  }

  /** Snapshot of all gauge series (name+labels key → value). */
  snapshotGauges(): ReadonlyMap<string, number> {
    return new Map(this.gauges);
  }
}

export const metricsRegistry = new MetricsRegistry();

export function resetMetricsRegistryForTests(): void {
  metricsRegistry.reset();
}

/** tour_creation_count{tenant_id} — successful canonical tour persist. */
export function recordTourCreated(tenantId: string): void {
  metricsRegistry.increment("tour_creation_count", { tenant_id: tenantId });
}

/** workspace_metadata_validation_errors_total{tenant_id,workspace_type} — metadata-path canonical validation fail. */
export function recordWorkspaceMetadataValidationError(
  tenantId: string,
  workspaceType: string
): void {
  metricsRegistry.increment("workspace_metadata_validation_errors_total", {
    tenant_id: tenantId,
    workspace_type: workspaceType,
  });
}

function workspaceTypeLabel(workspaceType: string | null | undefined): string {
  const normalized = workspaceType?.trim();
  return normalized !== undefined && normalized.length > 0 ? normalized : "global";
}

export function recordIntegrationConnectionCreated(input: {
  readonly tenantId: string;
  readonly provider: string;
  readonly workspaceType: string | null;
}): void {
  metricsRegistry.increment("integration_connection_created_total", {
    tenant_id: input.tenantId,
    provider: input.provider,
    workspace_type: workspaceTypeLabel(input.workspaceType),
  });
}

export function recordIntegrationConnectionCreateFailed(input: {
  readonly tenantId: string;
  readonly provider: string;
  readonly workspaceType: string | null;
  readonly reason: string;
}): void {
  metricsRegistry.increment("integration_connection_create_failed_total", {
    tenant_id: input.tenantId,
    provider: input.provider,
    workspace_type: workspaceTypeLabel(input.workspaceType),
    reason: input.reason,
  });
}

export function recordIntegrationDeliverySuccess(input: {
  readonly tenantId: string;
  readonly provider: string;
  readonly capability: string;
}): void {
  metricsRegistry.increment("integration_delivery_success_total", {
    tenant_id: input.tenantId,
    provider: input.provider,
    capability: input.capability,
  });
}

export function recordIntegrationDeliveryFailed(input: {
  readonly tenantId: string;
  readonly provider: string;
  readonly capability: string;
  readonly reason: string;
}): void {
  metricsRegistry.increment("integration_delivery_failed_total", {
    tenant_id: input.tenantId,
    provider: input.provider,
    capability: input.capability,
    reason: input.reason,
  });
}

export function recordFieldExposureShadowParityMismatch(input: {
  readonly tenantId: string;
  readonly eventType: string;
  readonly provider: string;
  readonly mismatchCount: number;
}): void {
  metricsRegistry.increment("field_exposure_shadow_parity_mismatch_total", {
    tenant_id: input.tenantId,
    event_type: input.eventType,
    provider: input.provider,
    mismatch_count: String(Math.max(1, input.mismatchCount)),
  });
}

export function recordFieldExposureEngineShadowMismatch(input: {
  readonly tenantId: string;
  readonly eventType: string;
  readonly surface: string;
  readonly mismatchCount: number;
}): void {
  metricsRegistry.increment(
    "field_exposure_engine_shadow_mismatch_total",
    {
      tenant_id: input.tenantId,
      event_type: input.eventType,
      surface: input.surface,
    },
    Math.max(1, input.mismatchCount),
  );
}

/** Phase 9.10 — forward engine selector could not produce engineSelectedFieldIds. */
export function recordFieldExposureEngineSelectorFailure(input: {
  readonly tenantId: string;
  readonly eventType: string;
  readonly surface: string;
}): void {
  metricsRegistry.increment("field_exposure_engine_selector_failure_total", {
    tenant_id: input.tenantId,
    event_type: input.eventType,
    surface: input.surface,
  });
}

type FieldExposureSelectionMetricInput = {
  readonly tenantId: string;
  readonly eventType: string;
  readonly provider: string;
  readonly runtimeMode: "shadow" | "cutover";
  readonly selectionSource: "native_exposure_intent" | "exposure_profile_defaults";
  readonly nativeIntentMissing: boolean;
};

/** Phase 13 — auditable runtime selection decisions in every diagnostic runtime mode. */
export function recordFieldExposureRuntimeSelection(
  input: FieldExposureSelectionMetricInput,
): void {
  metricsRegistry.increment("field_exposure_runtime_selection_total", {
    tenant_id: input.tenantId,
    event_type: input.eventType,
    provider: input.provider,
    runtime_mode: input.runtimeMode,
    selection_source: input.selectionSource,
    native_intent_missing: input.nativeIntentMissing ? "true" : "false",
  });
}

/** Phase 6 compatibility — cutover-only selection counter retained for existing dashboards. */
export function recordFieldExposureCutoverSelection(
  input: Omit<FieldExposureSelectionMetricInput, "runtimeMode">,
): void {
  metricsRegistry.increment("field_exposure_cutover_selection_total", {
    tenant_id: input.tenantId,
    event_type: input.eventType,
    provider: input.provider,
    selection_source: input.selectionSource,
    native_intent_missing: input.nativeIntentMissing ? "true" : "false",
  });
}

/** Phase 8 — authoritative exposure decision audit trail per emitted job. */
export function recordFieldExposureDecisionAudited(input: {
  readonly tenantId: string;
  readonly eventType: string;
  readonly provider: string;
  readonly selectionSource: "native_exposure_intent" | "exposure_profile_defaults";
  readonly resolverVersion: string;
}): void {
  metricsRegistry.increment("field_exposure_decision_audited_total", {
    tenant_id: input.tenantId,
    event_type: input.eventType,
    provider: input.provider,
    selection_source: input.selectionSource,
    resolver_version: input.resolverVersion,
  });
}
