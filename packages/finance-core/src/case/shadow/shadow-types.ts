/**
 * Internal shadow observation types — ephemeral only, never persisted.
 */

import type { CaseExecutionRequest } from "../execute/execution-types";

export type ShadowObservationMetadata = {
  /** Opaque caller label (e.g. test harness / future host trigger id). */
  readonly observationId?: string;
  readonly triggerKind?: "manual" | "post_mutation" | "sampled" | "other";
  readonly note?: string;
};

export type ShadowExecutionRequest = {
  readonly execution: CaseExecutionRequest;
  readonly observation?: ShadowObservationMetadata;
};

export type ShadowDiagnostics = {
  readonly observationId: string;
  readonly triggerKind: ShadowObservationMetadata["triggerKind"] | "unspecified";
  readonly shadowStartedAtMs: number;
  readonly shadowCompletedAtMs: number;
  readonly shadowDurationMs: number;
  readonly outcome: "ok" | "failed";
  readonly failureMessage?: string;
  readonly sinkErrorIgnored?: boolean;
};
