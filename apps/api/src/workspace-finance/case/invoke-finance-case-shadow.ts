/**
 * Optional Finance Case shadow invocation seam (PR4.5-B).
 *
 * Feature disabled → zero Case execution.
 * Feature enabled → runShadowFinanceCase; failures never throw to primary workflow.
 */

import {
  runShadowFinanceCase,
  type CaseFactAssemblerProviders,
  type ShadowExecutionRequest,
  type ShadowExecutionResult,
  type ShadowObservationSink,
} from "@app-tour/finance-core/case";

import { isFinanceCaseShadowEnabled } from "./finance-case-feature-flag";

export type FinanceCaseShadowSkipped = {
  readonly skipped: true;
  readonly reason: "disabled";
};

export type InvokeFinanceCaseShadowResult =
  | ShadowExecutionResult
  | FinanceCaseShadowSkipped;

export type InvokeFinanceCaseShadowInput = {
  /** Explicit override; when omitted, reads FINANCE_CASE_SHADOW_ENABLED. */
  readonly enabled?: boolean;
  readonly providers: CaseFactAssemblerProviders;
  readonly request: ShadowExecutionRequest;
  readonly sink?: ShadowObservationSink;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

/**
 * Host-owned shadow seam. Never throws for Case/shadow/sink failures when enabled
 * (runShadowFinanceCase already isolates). Disabled path returns immediately.
 */
export async function invokeFinanceCaseShadow(
  input: InvokeFinanceCaseShadowInput
): Promise<InvokeFinanceCaseShadowResult> {
  const enabled =
    input.enabled ?? isFinanceCaseShadowEnabled(input.env ?? process.env);
  if (!enabled) {
    return { skipped: true, reason: "disabled" };
  }
  return runShadowFinanceCase(input.providers, input.request, input.sink);
}

/**
 * Fire-and-forget wrapper for primary workflows.
 * Never rejects; never mutates caller state.
 */
export function scheduleFinanceCaseShadow(input: InvokeFinanceCaseShadowInput): void {
  void invokeFinanceCaseShadow(input).catch(() => {
    /* fail-open — primary workflow must not observe rejection */
  });
}
