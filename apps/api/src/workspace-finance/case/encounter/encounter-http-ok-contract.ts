/**
 * PR15-A — Encounter HTTP OK contract allowlist helpers (validation hardening).
 * Additive presentation metadata only — never CaseOutput / FactSnapshot / gateway DTOs.
 */

import assert from "node:assert/strict";

/** Required keys on successful Encounter HTTP body. */
export const FINANCE_CASE_ENCOUNTER_HTTP_OK_REQUIRED_KEYS = [
  "encounter",
  "executionId",
  "surfaceState",
  "commandCapability",
] as const;

/** Optional additive keys (PR14-B stale / capability seam). */
export const FINANCE_CASE_ENCOUNTER_HTTP_OK_OPTIONAL_KEYS = [
  "meaningFingerprint",
] as const;

const ALLOWED = new Set<string>([
  ...FINANCE_CASE_ENCOUNTER_HTTP_OK_REQUIRED_KEYS,
  ...FINANCE_CASE_ENCOUNTER_HTTP_OK_OPTIONAL_KEYS,
]);

/**
 * Assert HTTP 200 Encounter body uses only documented presentation keys.
 */
export function assertFinanceCaseEncounterHttpOkKeys(body: object): void {
  const keys = Object.keys(body);
  for (const key of keys) {
    assert.ok(
      ALLOWED.has(key),
      `unexpected Encounter HTTP key: ${key} (allowed: ${[...ALLOWED].sort().join(",")})`
    );
  }
  for (const required of FINANCE_CASE_ENCOUNTER_HTTP_OK_REQUIRED_KEYS) {
    assert.ok(
      keys.includes(required),
      `missing required Encounter HTTP key: ${required}`
    );
  }
}

/** Forbidden leakage patterns for presentation wire payloads. */
export const ENCOUNTER_HTTP_FORBIDDEN_LEAK_RE =
  /CaseOutput|FactSnapshot|"facts"|externalPaymentRef|paymentIntent|webhook|pi_[A-Za-z0-9]|cus_[A-Za-z0-9]|evt_[A-Za-z0-9]/i;

export function assertEncounterHttpNoForbiddenLeakage(payload: unknown): void {
  assert.doesNotMatch(JSON.stringify(payload), ENCOUNTER_HTTP_FORBIDDEN_LEAK_RE);
}
