/**
 * PR17-B — Stable Finance Command Center ↔ Encounter embedding contract.
 * Presentation / navigation only — never CaseOutput, FactSnapshot, or SoT DTOs.
 */

import type {
  CaseCommandCapabilityContract,
  CaseEncounterViewContract,
  EncounterSurfaceStateContract,
} from "@/finance/finance-case-encounter-ui";

import { withFinanceRegistrationQuery } from "@/finance/finance-registration-context";

/** Opaque registration subject for Meaning lookup (query param only). */
export type FinanceCommercialMeaningEmbedInput = {
  readonly registrationId: string;
  readonly counterpartyId?: string;
  /** Client load timeout budget (ms); default applied by panel. */
  readonly loadTimeoutMs?: number;
};

/**
 * Wire payload allowed into the Command Center Meaning embed.
 * Mirrors Host Encounter HTTP OK presentation keys (+ host chrome states).
 */
export type FinanceCommercialMeaningEmbedPayload = {
  readonly encounter: CaseEncounterViewContract;
  readonly surfaceState: Exclude<EncounterSurfaceStateContract, "loading" | "unavailable">;
  /** Opaque Host execution id — must change on every successful refresh. */
  readonly executionId: string;
  readonly commandCapability?: CaseCommandCapabilityContract;
  readonly meaningFingerprint?: string;
};

export type FinanceCommercialMeaningOperatorState =
  | "loading"
  | "unavailable"
  | "timeout"
  | "degraded"
  | "incomplete"
  | "normal"
  | "empty";

export const FINANCE_COMMERCIAL_MEANING_DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Deep link into Command Center Commercial Meaning for a registration.
 * Does not expose Case keys or internal execution ids in the URL.
 */
export function buildFinanceCommercialMeaningHref(
  registrationId: string,
  basePath = "/finance"
): string {
  const id = registrationId.trim();
  const withView = `${basePath}${basePath.includes("?") ? "&" : "?"}view=meaning`;
  return withFinanceRegistrationQuery(withView, id.length > 0 ? id : null);
}

export function isFinanceCommercialMeaningRegistrationId(value: string | null | undefined): boolean {
  const id = value?.trim() ?? "";
  return id.length >= 32;
}
