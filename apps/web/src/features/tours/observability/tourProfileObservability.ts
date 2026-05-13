/**
 * Client-side observability for the unified tour profile / `ProfileRules` stack.
 *
 * Emits **one-line JSON** to `console.warn` so log aggregators can grep `tour_profile_obs`
 * without shipping a separate analytics SDK. All emissions are:
 *
 * - **Failure / drift only** — never logs successful validation.
 * - **Env-gated in production** — set `NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY=1` to enable
 *   in prod builds. In `NODE_ENV === "development"`, wizard rule failures are emitted by
 *   default (still throttled).
 * - **Throttled** — repeated identical signatures within `DEDUPE_MS` are dropped to
 *   avoid spam when users hammer "Next".
 */

import { Legacy, type TourFormProfile } from "@repo/types";

type EventKind = Legacy.EventKind;

import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";
import type { ValidationIssue, ValidationResult } from "@/features/tours/wizard/profileRules/validation";

const LOG_PREFIX = "tour_profile_obs";

const DEDUPE_MS = 2_000;
const lastEmitted = new Map<string, number>();

function envFlagEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** True when client should emit `tour_profile_obs` lines for wizard validation failures. */
export function tourProfileObservabilityWizardFailuresEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return true;
  }
  return envFlagEnabled(process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY);
}

/** True for Edit drift / save-failure logs (stricter: only when env explicitly on). */
export function tourProfileObservabilityEditEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY);
}

function shouldEmitDeduped(signature: string): boolean {
  const now = Date.now();
  const prev = lastEmitted.get(signature);
  if (prev != null && now - prev < DEDUPE_MS) {
    return false;
  }
  lastEmitted.set(signature, now);
  if (lastEmitted.size > 64) {
    const cutoff = now - DEDUPE_MS * 10;
    for (const [k, t] of lastEmitted) {
      if (t < cutoff) lastEmitted.delete(k);
    }
  }
  return true;
}

export type WizardRulesValidationFailurePayload = {
  readonly level: "autosave" | "step_nav" | "submit";
  readonly form_profile: TourFormProfile;
  readonly step_id?: TourCreateWizardStepId;
  readonly visible_step_ids?: readonly TourCreateWizardStepId[];
  readonly zod_trigger_ok?: boolean;
  readonly result: ValidationResult;
};

/**
 * Logs a single structured line when rules-layer validation fails.
 * `rule_id` is always `profile_rules` (source); per-field codes come from `issues`.
 */
export function emitWizardRulesValidationFailure(payload: WizardRulesValidationFailurePayload): void {
  if (!tourProfileObservabilityWizardFailuresEnabled()) return;
  if (payload.result.isValid) return;

  const issuePaths = payload.result.issues.map((i: ValidationIssue) => i.path).sort();
  const issueCodes = payload.result.issues.map((i: ValidationIssue) => i.code);
  const signature = `wiz:${payload.level}:${payload.form_profile}:${payload.step_id ?? ""}:${issuePaths.join(",")}`;
  if (!shouldEmitDeduped(signature)) return;

  const line = {
    event: "wizard_rules_validation_failed",
    source: "profile_rules",
    level: payload.level,
    form_profile: payload.form_profile,
    step_id: payload.step_id,
    visible_step_ids: payload.visible_step_ids,
    zod_trigger_ok: payload.zod_trigger_ok,
    issue_paths: issuePaths,
    issue_codes: issueCodes,
    issue_count: payload.result.issues.length,
  };
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[${LOG_PREFIX}] ${JSON.stringify(line)}`);
  }
}

export type EditDomainClassificationDriftPayload = {
  readonly tour_id?: string;
  readonly domain_profile: TourFormProfile;
  readonly legacy_event_kind: EventKind;
  readonly projected_event_kind: EventKind;
  readonly unified_edit_resolver_enabled: boolean;
};

/** Emitted when Edit's dual classification reports `agrees: false` (Wizard vs legacy mismatch risk). */
export function emitEditDomainClassificationDrift(payload: EditDomainClassificationDriftPayload): void {
  if (!tourProfileObservabilityEditEnabled()) return;
  const signature = `edit:drift:${payload.tour_id ?? "new"}:${payload.domain_profile}`;
  if (!shouldEmitDeduped(signature)) return;

  const line = {
    event: "edit_domain_classification_drift",
    source: "tourDomainProfileAdapters",
    ...payload,
  };
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[${LOG_PREFIX}] ${JSON.stringify(line)}`);
  }
}

export type EditSaveProfileRelatedFailurePayload = {
  readonly tour_id?: string;
  readonly http_status: number;
  readonly error_code?: string;
  readonly error_message?: string;
  readonly domain_profile?: TourFormProfile;
  readonly unified_edit_resolver_enabled: boolean;
};

/** Emitted on Edit save 400 responses (often catalog / validation; may include profile strip rejects). */
export function emitEditSaveHttpFailure(payload: EditSaveProfileRelatedFailurePayload): void {
  if (!tourProfileObservabilityEditEnabled()) return;
  if (payload.http_status !== 400) return;
  const signature = `edit:save400:${payload.tour_id ?? "unknown"}:${payload.error_code ?? "none"}`;
  if (!shouldEmitDeduped(signature)) return;

  const line = {
    event: "edit_save_http_400",
    source: "TourForm",
    ...payload,
  };
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[${LOG_PREFIX}] ${JSON.stringify(line)}`);
  }
}
