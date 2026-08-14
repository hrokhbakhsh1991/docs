/**
 * PR17-C — Commercial Meaning client feedback events (report ingest).
 * Vendor-neutral; no CaseOutput / FactSnapshot / gateway DTOs.
 */

export type CommercialMeaningSurfaceState = "normal" | "degraded" | "incomplete";

export type CommercialMeaningClientEventName =
  | "meaning_opened"
  | "meaning_viewed"
  | "meaning_unavailable"
  | "meaning_timeout"
  | "meaning_incomplete"
  | "meaning_degraded"
  | "operator_returned_to_operational_view";

export type CommercialMeaningClientEvent = {
  readonly name: CommercialMeaningClientEventName;
  readonly tenantId?: string;
  readonly registrationId: string;
  readonly executionId?: string;
  readonly surfaceState?: CommercialMeaningSurfaceState;
  readonly reason?: string;
  readonly latencyMs?: number;
  readonly recordedAtMs: number;
};

/** Ops-supplied classic label vs Meaning reading pair (calibration only). */
export type ClassicVsMeaningDisagreementSample = {
  readonly tenantId?: string;
  readonly registrationId: string;
  readonly classicLabel: string;
  readonly meaningReading: string;
};
