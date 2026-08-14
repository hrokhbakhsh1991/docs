/**
 * PR19 — Summarize Host Command Bridge + Command UI client observations.
 */

import type { CaseCommandTelemetryEvent } from "../command-bridge/command-bridge-telemetry";

export type CommandUiClientEventName =
  | "command_discovered"
  | "command_confirmation_shown"
  | "command_submitted"
  | "command_retry"
  | "classic_review_submitted";

export type CommandUiClientEvent = {
  readonly name: CommandUiClientEventName;
  readonly registrationId?: string;
  readonly latencyMs?: number;
  readonly failureClass?: string;
  readonly ok?: boolean;
};

export type ControlledProductionCommandSummary = {
  readonly discovered: number;
  readonly confirmationShown: number;
  readonly submitted: number;
  readonly succeeded: number;
  readonly authDenied: number;
  readonly vocabularyDenied: number;
  readonly concurrencyConflict: number;
  readonly sotRejected: number;
  readonly providerUnavailable: number;
  readonly reexecuteFailed: number;
  readonly intentInvalid: number;
  readonly retries: number;
  readonly classicReviewSubmitted: number;
  readonly successRate: number | null;
  readonly staleRate: number | null;
  readonly authDeniedRate: number | null;
  readonly attemptRate: number | null;
  readonly latency: {
    readonly p50Ms: number | null;
    readonly p95Ms: number | null;
    readonly p99Ms: number | null;
    readonly sampleCount: number;
  };
};

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const weight = rank - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

export function summarizeControlledProductionCommands(input: {
  readonly hostEvents?: readonly CaseCommandTelemetryEvent[];
  readonly uiEvents?: readonly CommandUiClientEvent[];
  readonly meaningOpened?: number;
}): ControlledProductionCommandSummary {
  const host = input.hostEvents ?? [];
  const ui = input.uiEvents ?? [];

  const discovered = ui.filter((e) => e.name === "command_discovered").length;
  const confirmationShown = ui.filter((e) => e.name === "command_confirmation_shown").length;
  const submittedUi = ui.filter((e) => e.name === "command_submitted").length;
  const retries = ui.filter((e) => e.name === "command_retry").length;
  const classicReviewSubmitted = ui.filter((e) => e.name === "classic_review_submitted").length;

  const requested = host.filter((e) => e.event === "command_requested").length;
  const succeeded = host.filter((e) => e.event === "succeeded").length;
  const authDenied = host.filter((e) => e.event === "auth_denied").length;
  const vocabularyDenied = host.filter((e) => e.event === "vocabulary_denied").length;
  const concurrencyConflict = host.filter((e) => e.event === "stale_rejected").length;
  const sotRejected = host.filter((e) => e.event === "sot_rejected").length;
  const providerUnavailable = host.filter((e) => e.event === "provider_unavailable").length;
  const reexecuteFailed = host.filter((e) => e.event === "reexecute_failed").length;
  const intentInvalid = host.filter((e) => e.event === "intent_invalid").length;

  const submitted = Math.max(requested, submittedUi);
  const terminal =
    succeeded +
    authDenied +
    vocabularyDenied +
    concurrencyConflict +
    sotRejected +
    providerUnavailable +
    reexecuteFailed +
    intentInvalid;

  const samples = [
    ...host.map((e) => e.durationMs).filter((n): n is number => typeof n === "number"),
    ...ui
      .filter((e) => e.name === "command_submitted")
      .map((e) => e.latencyMs)
      .filter((n): n is number => typeof n === "number"),
  ]
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);

  const meaningOpened = input.meaningOpened ?? 0;

  return {
    discovered,
    confirmationShown,
    submitted,
    succeeded,
    authDenied,
    vocabularyDenied,
    concurrencyConflict,
    sotRejected,
    providerUnavailable,
    reexecuteFailed,
    intentInvalid,
    retries,
    classicReviewSubmitted,
    successRate: terminal === 0 ? null : succeeded / terminal,
    staleRate: terminal === 0 ? null : concurrencyConflict / terminal,
    authDeniedRate: terminal === 0 ? null : authDenied / terminal,
    attemptRate: meaningOpened === 0 ? null : submitted / meaningOpened,
    latency: {
      p50Ms: percentile(samples, 50),
      p95Ms: percentile(samples, 95),
      p99Ms: percentile(samples, 99),
      sampleCount: samples.length,
    },
  };
}
