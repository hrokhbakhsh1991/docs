/**
 * PR15-H — Build observation-only provider degradation telemetry events.
 * Never invents UI severity or Case readings; fail-open at emit site.
 */

import type { EncounterTelemetryEvent } from "./encounter-telemetry";

export type EncounterProviderName =
  | "obligation"
  | "payment"
  | "evidence"
  | "lifecycle"
  | "ledger"
  | "signal";

export type EncounterProviderDegradationInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly provider: EncounterProviderName;
  readonly failureReason: string;
  readonly optional: boolean;
  readonly latencyMs?: number;
  readonly recordedAtMs: number;
};

const OPTIONAL_PROVIDERS: ReadonlySet<EncounterProviderName> = new Set(["ledger", "signal"]);

export function isOptionalEncounterProvider(provider: EncounterProviderName): boolean {
  return OPTIONAL_PROVIDERS.has(provider);
}

/**
 * Normalize Host/assembler failure reasons into telemetry reason codes.
 * Strips values that look like business payloads.
 */
export function normalizeProviderDegradationReason(raw: string | undefined): string {
  if (raw === undefined || raw.trim().length === 0) {
    return "unavailable";
  }
  const trimmed = raw.trim().slice(0, 64);
  if (/CaseOutput|FactSnapshot|amountDue|remaining/i.test(trimmed)) {
    return "redacted";
  }
  return trimmed;
}

export function buildProviderDegradationTelemetryEvent(
  input: EncounterProviderDegradationInput
): EncounterTelemetryEvent {
  return {
    kind: "provider_degradation",
    tenantId: input.tenantId,
    registrationId: input.registrationId,
    provider: input.provider,
    failureReason: normalizeProviderDegradationReason(input.failureReason),
    optional: input.optional,
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    recordedAtMs: input.recordedAtMs,
  };
}

export type ProviderStatusLike = {
  readonly invoked?: boolean;
  readonly ok?: boolean;
  readonly degraded?: boolean;
  readonly failureReason?: string;
};

/**
 * Emit one event per degraded invoked provider. Callers pass fail-open sink emit.
 */
export function listProviderDegradationTelemetryEvents(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly recordedAtMs: number;
  readonly providers: Partial<Record<EncounterProviderName, ProviderStatusLike>>;
}): readonly EncounterTelemetryEvent[] {
  const out: EncounterTelemetryEvent[] = [];
  for (const provider of Object.keys(input.providers) as EncounterProviderName[]) {
    const status = input.providers[provider];
    if (status === undefined || status.invoked === false) {
      continue;
    }
    if (status.degraded !== true && status.ok !== false) {
      continue;
    }
    out.push(
      buildProviderDegradationTelemetryEvent({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        provider,
        failureReason: status.failureReason ?? "unavailable",
        optional: isOptionalEncounterProvider(provider),
        recordedAtMs: input.recordedAtMs,
      })
    );
  }
  return out;
}
